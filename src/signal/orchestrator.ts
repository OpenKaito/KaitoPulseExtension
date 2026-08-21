import type { AvatarSignalProfile, SignalPopoverData, SignalProfileSnapshot, SignalProtocol } from "./types";
import { createLogger } from "./logger";
import { createAvatarSignalBadgeElement, setAvatarBadgeValue, updateAvatarBadgeTier } from "./avatar-badge";
import { getSmartFollowerTier } from "./avatar-badge-tiers";
import { createNameTagElement, setNameTagProtocols } from "./name-tag";
import { NameTagPopover, loadPopoverData } from "./name-tag-popover";
import { TokenChartPopover, loadTokenChart } from "./token-chart/popover";
import { normalizeCashtagSymbol } from "./token-chart/symbol";
import { hasTweetAuthor, rememberTweetAuthor, resolveTicker } from "./token-chart/resolve";
import { BadgesBatcher } from "./badges";
import { badgeToNameTagEntries, hoverCardToFollowerStats } from "./social-card-map";
import { isEnabled, type SignalSettings, type SignalSurfaceKey } from "./settings";
import { ORCHESTRATOR_SURFACE_REGISTRY, scanForAnchor, type ScanKind, type SurfaceDef } from "./surfaces";
import { HealthMonitor } from "./dom/health-monitor";
import {
  SIGNAL_DOM_SELECTORS as SELECTORS,
  SIGNAL_DOM_ATTRS as DOM_ATTRS,
} from "./dom/selectors";
import { detectAvatarShape, detectAvatarSize } from "./dom/geometry";
import {
  DomAdapter,
  getAvatarRootHandle,
  getArticleAuthorHandle,
  getArticleAuthorProfile,
  getArticleTweetId,
  getArticleNoticeAnchor,
} from "./dom/adapter";
import { resolveTwitterId } from "./identity";
import { hostPrefersDark } from "./host-theme";
import { getHoverCard } from "./hover-card-store";
import { createHoverCardStatsElement, renderFollowerStats } from "./hovercard-stats";
import { AdFlagPopover } from "./ad-flag/popover";
import { createAdFlagButtonElement, setAdFlagButtonState } from "./ad-flag/button";
import { createAdFlagNoticeElement, setAdFlagNoticeCount } from "./ad-flag/notice";
import { AdFlagStore } from "./ad-flag/store";
import { guard } from '@/lib/guard';

const BADGE_PARTIAL_POKE_MS = 5_000;

const HEALTH_CHECK_INTERVAL_MS = 10_000;

let feedSweepSeq = 0;

interface BadgeSub {
  el: HTMLElement;
  unsub: () => void;

  twitterId: string | null;

  partial: boolean;
}

export class Orchestrator {
  private readonly logger = createLogger("orchestrator");
  private readonly document: Document;
  private readonly cleanups: Array<() => void> = [];
  private readonly popover: NameTagPopover;
  private readonly tokenChartPopover: TokenChartPopover;
  private readonly adFlagPopover: AdFlagPopover;

  private readonly badges = new BadgesBatcher();

  private readonly badgeSubs = new Set<BadgeSub>();

  private readonly adFlags = new AdFlagStore();

  private readonly adFlagSubs = new Set<{ el: HTMLElement; unsub: () => void }>();

  private lastBadgePokeAt = 0;

  private lastHealthCheckAt = 0;
  private readonly healthMonitor = new HealthMonitor();

  private feedSweepGeneration = ++feedSweepSeq;
  private readonly adapter: DomAdapter;
  private settings: SignalSettings;

  private readonly onArticleSwept: ((article: HTMLElement) => void) | undefined;

  constructor(
    doc: Document = document,
    settings: SignalSettings = {},
    onArticleSwept?: (article: HTMLElement) => void,
  ) {
    this.document = doc;
    this.settings = settings;
    this.popover = new NameTagPopover(doc);
    this.tokenChartPopover = new TokenChartPopover(doc);
    this.popover.setOnOpen(() => this.tokenChartPopover.close());
    this.tokenChartPopover.setOnOpen(() => this.popover.close());
    this.adFlagPopover = new AdFlagPopover(doc, this.adFlags);
    this.adapter = new DomAdapter(doc);
    this.onArticleSwept = onArticleSwept;
  }

  private injectFeedBadges(): number {
    const nametagOn = isEnabled(this.settings, 'nametag.feed');
    const avatarOn = isEnabled(this.settings, 'avatar.feed');
    const quotedAvatarOn = isEnabled(this.settings, 'avatar.quoted');
    const adFlagOn = isEnabled(this.settings, 'adFlag.feed');
    const tokenChartOn = isEnabled(this.settings, 'tokenChart.feed');

    if (!nametagOn && !avatarOn && !quotedAvatarOn && !adFlagOn && !tokenChartOn && !this.onArticleSwept) return 0;

    const avatarIndex = avatarOn ? this.adapter.buildFeedAvatarIndex() : null;

    const genStr = String(this.feedSweepGeneration);

    let injectedCount = 0;
    for (const articleNode of this.document.querySelectorAll(SELECTORS.ARTICLE)) {
      const article = articleNode as HTMLElement;
      const alreadySwept = article.getAttribute(DOM_ATTRS.FEED_SWEPT) === genStr;

      if (!alreadySwept) {
        const handle = getArticleAuthorHandle(article);
        if (!handle) continue;

        const id = handle;

        this.onArticleSwept?.(article);

        if (nametagOn && this.injectNameTag(article, id)) {
          injectedCount++;
        }

        if (adFlagOn && this.injectAdFlagButton(article)) {
          injectedCount++;
        }

        if (avatarOn && avatarIndex) {
          for (const { avatarRoot, surface } of this.adapter.discoverFeedAvatars(article, handle, avatarIndex)) {

            if (!isEnabled(this.settings, surface)) continue;

            const avatarSize = detectAvatarSize(avatarRoot);
            const identity = getAvatarRootHandle(avatarRoot) ?? '';
            const avatarMount = this.adapter.mount(avatarRoot, id, identity, avatarSize, surface);
            if (!avatarMount) continue;

            const profile = this.createAvatarProfile(id, detectAvatarShape(avatarRoot), avatarSize);

            const badgeEl = createAvatarSignalBadgeElement({ ...profile, value: '' });
            avatarMount.container.appendChild(badgeEl);
            this.applyBadgeSmartFollowers(badgeEl, handle);
            injectedCount++;
          }
        }

        if (quotedAvatarOn) {
          for (const { avatarRoot, handle: quotedHandle, surface } of this.adapter.discoverQuotedAvatars(article)) {
            const avatarSize = detectAvatarSize(avatarRoot);
            const avatarMount = this.adapter.mount(avatarRoot, quotedHandle, quotedHandle, avatarSize, surface);
            if (!avatarMount) continue;

            const profile = this.createAvatarProfile(quotedHandle, detectAvatarShape(avatarRoot), avatarSize);
            const badgeEl = createAvatarSignalBadgeElement({ ...profile, value: '' });
            avatarMount.container.appendChild(badgeEl);
            this.applyBadgeSmartFollowers(badgeEl, quotedHandle);
            injectedCount++;
          }
        }

        article.setAttribute(DOM_ATTRS.FEED_SWEPT, genStr);
      }

      if (tokenChartOn) {

        const tickerTweetId = getArticleTweetId(article);

        if (tickerTweetId && !hasTweetAuthor(tickerTweetId)) {
          const tweetAuthorHandle = getArticleAuthorHandle(article);
          if (tweetAuthorHandle) {
            void resolveTwitterId(tweetAuthorHandle, undefined).then((authorTwitterId) => {
              if (authorTwitterId) rememberTweetAuthor(tickerTweetId, authorTwitterId);
            });
          }
        }

        for (const tweetText of article.querySelectorAll(SELECTORS.TWEET_TEXT)) {
          for (const anchor of tweetText.querySelectorAll(SELECTORS.CASHTAG_LINK)) {
            const anchorEl = anchor as HTMLElement;
            if (anchorEl.getAttribute(DOM_ATTRS.CASHTAG_SWEPT) === genStr) continue;

            anchorEl.setAttribute(DOM_ATTRS.CASHTAG_SWEPT, genStr);
            const symbol = normalizeCashtagSymbol(anchor.textContent);
            if (!symbol) continue;

            anchorEl.setAttribute(DOM_ATTRS.SURFACE, 'tokenChart.feed');
            injectedCount++;

            resolveTicker(symbol, tickerTweetId).then((resolved) => {
              if (!resolved) return;
              if (!isEnabled(this.settings, 'tokenChart.feed')) return;

              anchorEl.setAttribute(DOM_ATTRS.CASHTAG_CHIP, hostPrefersDark(this.document) ? 'dark' : 'light');

              this.tokenChartPopover.register(anchorEl, symbol, resolved.name, resolved.logo, (period) =>
                loadTokenChart(symbol, period, resolved.tickerId),
              );
            });
          }
        }
      }
    }

    if (injectedCount) this.logger.log(`injected ${injectedCount} feed components`);
    return injectedCount;
  }

  private hideNativeCashtagCards(): void {
    if (!isEnabled(this.settings, 'tokenChart.feed')) return;
    for (const logo of this.document.querySelectorAll(SELECTORS.SMART_TAG_CARD_LOGO)) {
      const card = logo.closest('[data-testid="cellInnerDiv"]') as HTMLElement | null;
      if (!card || card.hasAttribute(DOM_ATTRS.NATIVE_CASHTAG_CARD_HIDDEN)) continue;
      card.setAttribute(DOM_ATTRS.NATIVE_CASHTAG_CARD_HIDDEN, '');
      card.style.display = 'none';
    }
  }

  private restoreNativeCashtagCards(): void {
    for (const card of this.document.querySelectorAll(`[${DOM_ATTRS.NATIVE_CASHTAG_CARD_HIDDEN}]`)) {
      (card as HTMLElement).style.display = '';
      card.removeAttribute(DOM_ATTRS.NATIVE_CASHTAG_CARD_HIDDEN);
    }
  }

  private injectNameTag(article: HTMLElement, id: string): boolean {
    const userName = article.querySelector(SELECTORS.USER_NAME) as HTMLElement | null;
    if (!userName) return false;
    if (userName.querySelector(`[${DOM_ATTRS.NAMETAG_INJECTED_FLAG}]`)) return false;

    const tag = createNameTagElement({ id, entries: [] });
    tag.classList.add('signal-name-tag--loading');
    tag.setAttribute(DOM_ATTRS.NAMETAG_INJECTED_FLAG, id);
    tag.setAttribute(DOM_ATTRS.SURFACE, 'nametag.feed');

    const time = userName.querySelector('time');
    const timeAnchor = time?.closest('a') ?? null;
    if (timeAnchor && userName.contains(timeAnchor)) {
      timeAnchor.insertAdjacentElement('afterend', tag);
    } else if (time && userName.contains(time)) {
      time.parentElement?.appendChild(tag);
    } else {

      const nameLink = userName.querySelector('a[role="link"][href^="/"]');
      let nameLine: HTMLElement | null = nameLink as HTMLElement | null;
      while (nameLine && nameLine.parentElement !== userName) {
        nameLine = nameLine.parentElement;
      }
      (nameLine ?? userName).appendChild(tag);
    }

    const handle = getArticleAuthorHandle(article);
    if (handle) tag.dataset.signalHandle = handle;

    if (isEnabled(this.settings, 'nametag.feedPopover')) {
      this.popover.register(tag, () => this.loadPopoverForHandle(handle), () => this.resolveTagProfile(tag));
    }

    this.applyBadgePlatforms(tag, handle);
    return true;
  }

  private injectAdFlagButton(article: HTMLElement): boolean {
    const tweetId = getArticleTweetId(article);
    if (!tweetId) return false;

    const caret = article.querySelector(SELECTORS.MORE_MENU) as HTMLElement | null;
    const caretCell = caret?.parentElement?.parentElement ?? null;
    const flexRow = caretCell?.parentElement ?? null;
    if (!flexRow || !caretCell) return false;
    if (flexRow.querySelector(`[${DOM_ATTRS.AD_FLAG_INJECTED_FLAG}]`)) return false;

    const btn = createAdFlagButtonElement(tweetId, hostPrefersDark(this.document));
    btn.setAttribute(DOM_ATTRS.AD_FLAG_INJECTED_FLAG, tweetId);
    btn.setAttribute(DOM_ATTRS.SURFACE, 'adFlag.feed');
    flexRow.insertBefore(btn, caretCell);

    const notice = this.injectAdFlagNotice(article, tweetId);
    this.adFlagPopover.register(btn, tweetId);

    const sub = { el: btn, unsub: () => {} };
    sub.unsub = this.adFlags.observe(tweetId, (item) => {
      if (!btn.isConnected) {
        sub.unsub();
        return;
      }
      setAdFlagButtonState(btn, item?.myReason != null);
      if (notice) setAdFlagNoticeCount(notice, item?.count ?? 0);
    });
    this.adFlagSubs.add(sub);
    return true;
  }

  private injectAdFlagNotice(article: HTMLElement, tweetId: string): HTMLElement | undefined {
    const anchor = getArticleNoticeAnchor(article);
    if (!anchor?.parentElement) return undefined;
    if (anchor.parentElement.querySelector(`[${DOM_ATTRS.AD_FLAG_NOTICE_INJECTED_FLAG}]`)) return undefined;

    const notice = createAdFlagNoticeElement(tweetId, 0);
    notice.setAttribute(DOM_ATTRS.AD_FLAG_NOTICE_INJECTED_FLAG, tweetId);
    notice.setAttribute(DOM_ATTRS.SURFACE, 'adFlag.feed');
    anchor.insertAdjacentElement('afterend', notice);
    return notice;
  }

  private async loadPopoverForHandle(
    handle: string | null,
    idHint?: string | null,
  ): Promise<SignalPopoverData> {
    const twitterId = await resolveTwitterId(handle, idHint);
    if (!twitterId) throw new Error('signal: twitter_id unavailable for hover card');
    return loadPopoverData(twitterId);
  }

  private resolveTagProfile(tag: HTMLElement): SignalProfileSnapshot | undefined {
    const article = tag.closest(SELECTORS.ARTICLE) as HTMLElement | null;
    return article ? getArticleAuthorProfile(article) ?? undefined : undefined;
  }

  private applyBadgePlatforms(tag: HTMLElement, handle: string | null, idHint?: string | null): void {
    void resolveTwitterId(handle, idHint).then((twitterId) => {
      if (!tag.isConnected) return;
      if (!twitterId) {
        this.markNameTagEmpty(tag);
        return;
      }
      const unsubscribe = this.badges.observe(twitterId, (badge) => {
        if (!tag.isConnected) {
          unsubscribe();
          return;
        }
        const entries = badgeToNameTagEntries(badge);
        const trading = badge?.trading;

        const hasTradingChip = !!trading && (trading.bucket !== null || trading.platforms.length > 0);
        if (entries.length === 0 && !hasTradingChip) {
          this.markNameTagEmpty(tag);
          return;
        }
        setNameTagProtocols(tag, entries, hostPrefersDark(document), trading);
        tag.classList.remove('signal-name-tag--loading');

        const skeleton = Array.from(
          new Set([...entries.map((entry) => entry.protocol), ...(trading?.platforms ?? [])]),
        ).filter((p): p is SignalProtocol => p === "hyperliquid" || p === "polymarket");
        this.popover.updatePlatforms(tag, skeleton);
      });

      this.badgeSubs.add({ el: tag, unsub: unsubscribe, twitterId: null, partial: false });
    });
  }

  private markNameTagEmpty(tag: HTMLElement): void {
    this.popover.unregister(tag);
    tag.classList.add('signal-name-tag--loading');
  }

  private applyBadgeSmartFollowers(badgeEl: HTMLElement, handle: string | null, idHint?: string | null): void {
    void resolveTwitterId(handle, idHint).then((twitterId) => {
      if (!badgeEl.isConnected) return;
      if (!twitterId) {
        badgeEl.remove();
        return;
      }
      const sub: BadgeSub = { el: badgeEl, unsub: () => {}, twitterId, partial: false };
      sub.unsub = this.badges.observe(twitterId, (badge) => {
        if (!badgeEl.isConnected) {
          sub.unsub();
          return;
        }
        if (!badge) {
          badgeEl.remove();
          sub.unsub();
          return;
        }
        const sf = badge.smartFollowers;
        const isCount = typeof sf === 'number' && Number.isFinite(sf);

        sub.partial = !isCount;
        const tier = getSmartFollowerTier(isCount ? sf : null);

        if (tier === 'no-data') {
          this.logger.warn('avatar N/A', {
            handle,
            idHint,
            twitterId,
            sfType: typeof sf,
            badge: JSON.stringify(badge),
          });
        }
        updateAvatarBadgeTier(badgeEl, tier, hostPrefersDark(document));
        if (tier === 'no-data') {
          setAvatarBadgeValue(badgeEl, 'N/A');
        } else if (isCount) {

          setAvatarBadgeValue(badgeEl, tier === 'no-sf' ? '0' : sf.toLocaleString('en-US'));
        }
      });
      this.badgeSubs.add(sub);
    });
  }

  private pruneBadgeSubs(): void {
    for (const sub of this.badgeSubs) {
      if (!sub.el.isConnected) {
        sub.unsub();
        this.badgeSubs.delete(sub);
      }
    }
    for (const sub of this.adFlagSubs) {
      if (!sub.el.isConnected) {
        sub.unsub();
        this.adFlagSubs.delete(sub);
      }
    }
  }

  private repokePartialBadges(): void {
    if (this.badgeSubs.size === 0) return;
    const now = Date.now();
    if (now - this.lastBadgePokeAt < BADGE_PARTIAL_POKE_MS) return;
    this.lastBadgePokeAt = now;
    const poked = new Set<string>();
    for (const sub of this.badgeSubs) {
      if (!sub.partial || sub.twitterId === null || !sub.el.isConnected) continue;
      if (poked.has(sub.twitterId)) continue;
      poked.add(sub.twitterId);
      void this.badges.request(sub.twitterId);
    }
  }

  private checkSelectorHealth(): void {
    const now = Date.now();
    if (now - this.lastHealthCheckAt < HEALTH_CHECK_INTERVAL_MS) return;
    this.lastHealthCheckAt = now;

    if (!this.isScanKindEnabled('feed')) {

      this.healthMonitor.reset();
      return;
    }
    const count = this.document.querySelectorAll(SELECTORS.ARTICLE).length;

    const tweetAvatarCount = count > 0
      ? 0
      : this.document.querySelectorAll(SELECTORS.TWEET_AVATAR).length;
    this.healthMonitor.recordDiscovery(count, tweetAvatarCount);
  }

  private isScanKindEnabled(kind: ScanKind): boolean {
    switch (kind) {
      case 'feed':
        return isEnabled(this.settings, 'nametag.feed') ||
          isEnabled(this.settings, 'avatar.feed') ||
          isEnabled(this.settings, 'avatar.quoted');
      case 'userCell':
        return isEnabled(this.settings, 'avatar.usercell');
      case 'hoverCard':
        return isEnabled(this.settings, 'avatar.hovercard') ||
          isEnabled(this.settings, 'nametag.hovercard') ||
          isEnabled(this.settings, 'stats.hovercard');
    }
  }

  observeSignalSurfaces(target: Node = this.document): () => void {
    const dispose = this.adapter.observe(
      {
        onFeed: guard(() => {
          this.pruneBadgeSubs();
          this.injectFeedBadges();
          this.hideNativeCashtagCards();
        }, 'orchestrator.onFeed'),
        onUserCell: guard(() => {
          this.pruneBadgeSubs();
          this.injectUserCellBadges();
        }, 'orchestrator.onUserCell'),
        onHoverCard: guard(() => {
          this.pruneBadgeSubs();
          this.injectHoverCardSignals();
        }, 'orchestrator.onHoverCard'),
        onMaintenance: guard(() => {
          this.repokePartialBadges();
          this.checkSelectorHealth();
        }, 'orchestrator.onMaintenance'),
      },
      target,
    );
    this.cleanups.push(dispose);
    return dispose;
  }

  private injectUserCellBadges(): number {
    if (!isEnabled(this.settings, 'avatar.usercell')) return 0;

    let injectedCount = 0;

    for (const { avatarRoot, id: userId, handle } of this.adapter.discoverUserCellAvatars()) {
      const avatarSize = detectAvatarSize(avatarRoot);
      const avatarMount = this.adapter.mount(avatarRoot, userId, handle ?? '', avatarSize, 'avatar.usercell');
      if (!avatarMount) continue;

      const badgeEl = createAvatarSignalBadgeElement({
        ...this.createAvatarProfile(userId, detectAvatarShape(avatarRoot), avatarSize),
        value: '',
      });
      avatarMount.container.appendChild(badgeEl);
      this.applyBadgeSmartFollowers(badgeEl, handle, userId);
      injectedCount++;
    }
    return injectedCount;
  }

  private injectHoverCardSignals(): void {
    const avatarOn = isEnabled(this.settings, 'avatar.hovercard');
    const nametagOn = isEnabled(this.settings, 'nametag.hovercard');
    const statsOn = isEnabled(this.settings, 'stats.hovercard');
    if (!avatarOn && !nametagOn && !statsOn) return;

    for (const { card, avatarRoot, id } of this.adapter.discoverHoverCardSignals()) {
      if (avatarOn) {
        const avatarSize = detectAvatarSize(avatarRoot);
        const identity = getAvatarRootHandle(avatarRoot) ?? '';
        const avatarMount = this.adapter.mount(avatarRoot, id, identity, avatarSize, 'avatar.hovercard');
        if (avatarMount) {
          const badgeEl = createAvatarSignalBadgeElement({
            ...this.createAvatarProfile(id, detectAvatarShape(avatarRoot), avatarSize),
            value: '',
          });
          avatarMount.container.appendChild(badgeEl);
          this.applyBadgeSmartFollowers(badgeEl, getAvatarRootHandle(avatarRoot), id);
        }
      }

      if (nametagOn) {
        this.injectHoverCardNameTag(card, getAvatarRootHandle(avatarRoot), id);
      }

      if (statsOn) {
        this.injectHoverCardStats(card, getAvatarRootHandle(avatarRoot), id);
      }
    }
  }

  private injectHoverCardNameTag(card: HTMLElement, handle: string | null, id: string): void {
    if (!handle) return;
    if (card.querySelector(`[${DOM_ATTRS.NAMETAG_INJECTED_FLAG}]`)) return;

    const nameLink = this.findHoverCardNameLink(card, handle);
    if (!nameLink) return;

    const tag = createNameTagElement({ id, entries: [] });
    tag.classList.add('signal-name-tag--loading');
    tag.setAttribute(DOM_ATTRS.NAMETAG_INJECTED_FLAG, id);
    tag.setAttribute(DOM_ATTRS.SURFACE, 'nametag.hovercard');
    (nameLink.firstElementChild ?? nameLink).appendChild(tag);

    this.applyBadgePlatforms(tag, handle, id);
  }

  private injectHoverCardStats(card: HTMLElement, handle: string | null, idHint: string): void {
    if (card.querySelector(`[${DOM_ATTRS.STATS_INJECTED_FLAG}]`)) return;

    const followingLink = card.querySelector(SELECTORS.HOVER_CARD_FOLLOWING_LINK);
    const followingRow = followingLink?.parentElement?.parentElement;
    const followingRowWrap = followingRow?.parentElement;
    if (!followingRowWrap) return;

    const isDark = hostPrefersDark(document);
    const placeholder = createHoverCardStatsElement(isDark);
    placeholder.setAttribute(DOM_ATTRS.STATS_INJECTED_FLAG, '');
    placeholder.setAttribute(DOM_ATTRS.SURFACE, 'stats.hovercard');
    followingRowWrap.insertAdjacentElement('afterend', placeholder);

    void resolveTwitterId(handle, idHint).then(async (twitterId) => {
      if (!placeholder.isConnected) return;
      if (!twitterId) {
        placeholder.remove();
        return;
      }
      const result = await getHoverCard(twitterId);
      if (!placeholder.isConnected) return;
      const stats = result ? hoverCardToFollowerStats(result) : [];
      if (stats.length === 0) {
        placeholder.remove();
        return;
      }
      renderFollowerStats(placeholder, stats, isDark);
    });
  }

  private findHoverCardNameLink(card: HTMLElement, handle: string): HTMLElement | null {
    for (const link of card.querySelectorAll('a[role="link"][href^="/"]')) {
      const anchor = link as HTMLAnchorElement;
      const segments = (anchor.getAttribute('href') || '').split('/').filter(Boolean);
      if (segments.length !== 1 || segments[0].toLowerCase() !== handle) continue;

      const text = anchor.textContent?.trim();
      if (!text || text.startsWith('@')) continue;
      if (anchor.querySelector(SELECTORS.AVATAR_CONTAINER)) continue;

      return anchor;
    }
    return null;
  }

  private createAvatarProfile(
    tweetId: string,
    avatarShape: 'circle' | 'square',
    avatarSize: AvatarSignalProfile['avatarSize'] = 'regular'
  ): AvatarSignalProfile {
    const profile = {
      tweetId,

      label: 'X',
      value: this.deriveDisplayValue(tweetId),
    };

    return {
      ...profile,
      ...(avatarShape === 'square' ? { avatarShape } : {}),
      ...(avatarSize !== 'regular' ? { avatarSize } : {}),
    };
  }

  private deriveDisplayValue(seed: string): string {
    const tail = Number.parseInt(seed.slice(-6), 10);
    if (Number.isFinite(tail)) return tail.toLocaleString('en-US');

    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
    }
    return (hash % 1_000_000).toLocaleString('en-US');
  }

  applySettings(next: SignalSettings): void {
    const prev = this.settings;
    this.settings = next;

    this.feedSweepGeneration = ++feedSweepSeq;
    for (const def of ORCHESTRATOR_SURFACE_REGISTRY) {
      const was = isEnabled(prev, def.key);
      const now = isEnabled(next, def.key);
      if (was === now) continue;
      if (now) this.enableSurface(def);
      else this.disableSurface(def);
    }
  }

  private enableSurface(def: SurfaceDef): void {
    if (def.widget === 'popover') {

      for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.parent}"]`)) {
        const tagEl = node as HTMLElement;

        const handle = tagEl.dataset.signalHandle ?? null;
        this.popover.register(tagEl, () => this.loadPopoverForHandle(handle), () => this.resolveTagProfile(tagEl));
      }
      return;
    }
    this.runScan(scanForAnchor(def.anchor));
  }

  private disableSurface(def: SurfaceDef): void {
    switch (def.widget) {
      case 'avatar':
        this.removeAvatarSurface(def.key);
        break;
      case 'nametag':

        for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.key}"]`)) {
          this.popover.unregister(node as HTMLElement);
          node.remove();
        }
        break;
      case 'stats':
        for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.key}"]`)) {
          node.remove();
        }
        break;
      case 'popover':

        for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.parent}"]`)) {
          this.popover.unregister(node as HTMLElement);
        }
        break;
      case 'adflag':
        for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.key}"]`)) {
          this.adFlagPopover.unregister(node as HTMLElement);
          node.remove();
        }
        break;
      case 'tokenPopover':

        for (const node of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${def.key}"]`)) {
          const anchorEl = node as HTMLElement;
          this.tokenChartPopover.unregister(anchorEl);
          anchorEl.removeAttribute(DOM_ATTRS.CASHTAG_CHIP);
        }
        this.restoreNativeCashtagCards();
        break;
    }
  }

  private runScan(scan: ScanKind): void {
    switch (scan) {
      case 'feed':
        this.injectFeedBadges();
        this.hideNativeCashtagCards();
        break;
      case 'userCell':
        this.injectUserCellBadges();
        break;
      case 'hoverCard':
        this.injectHoverCardSignals();
        break;
    }
  }

  private removeAvatarSurface(key: SignalSurfaceKey): void {
    for (const mount of this.document.querySelectorAll(`[${DOM_ATTRS.SURFACE}="${key}"]`)) {
      const host = mount.parentElement;
      mount.remove();

      if (host && !host.querySelector(`[${DOM_ATTRS.AVATAR_INJECTED_FLAG}]`)) {
        host.classList.remove('signal-avatar-host');
      }
    }
  }

  cleanup(): void {
    try {
      this.popover.destroy();

      this.document
        .querySelectorAll(`[${DOM_ATTRS.SURFACE}="tokenChart.feed"]`)
        .forEach((node) => {
          const anchorEl = node as HTMLElement;
          this.tokenChartPopover.unregister(anchorEl);
          anchorEl.removeAttribute(DOM_ATTRS.SURFACE);
          anchorEl.removeAttribute(DOM_ATTRS.CASHTAG_CHIP);
        });
      this.restoreNativeCashtagCards();
      this.tokenChartPopover.destroy();
      this.adFlagPopover.destroy();
      this.badges.dispose();
      this.adFlags.dispose();
      for (const sub of this.badgeSubs) sub.unsub();
      this.badgeSubs.clear();
      for (const sub of this.adFlagSubs) sub.unsub();
      this.adFlagSubs.clear();
      for (const fn of this.cleanups.splice(0)) {
        try {
          fn();
        } catch (error) {
          this.logger.error("observer cleanup failed", error);
        }
      }

      this.document
        .querySelectorAll(
          `[${DOM_ATTRS.AVATAR_INJECTED_FLAG}], [${DOM_ATTRS.NAMETAG_INJECTED_FLAG}], [${DOM_ATTRS.STATS_INJECTED_FLAG}], [${DOM_ATTRS.AD_FLAG_INJECTED_FLAG}], [${DOM_ATTRS.AD_FLAG_NOTICE_INJECTED_FLAG}]`
        )
        .forEach((node) => node.remove());

      this.document
        .querySelectorAll(`[${DOM_ATTRS.FEED_SWEPT}]`)
        .forEach((node) => node.removeAttribute(DOM_ATTRS.FEED_SWEPT));
      this.document
        .querySelectorAll(`[${DOM_ATTRS.CASHTAG_SWEPT}]`)
        .forEach((node) => node.removeAttribute(DOM_ATTRS.CASHTAG_SWEPT));
      this.logger.log("cleanup completed");
    } catch (error) {
      this.logger.error("cleanup failed", error);
    }
  }
}
