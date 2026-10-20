import {
  createMemo,
  createSignal,
  type Accessor,
  type Setter,
  For,
  Show,
  Switch,
  Match,
  type JSX,
} from 'solid-js';
import { render } from 'solid-js/web';
import type { SignalPopoverData, SignalProfileSnapshot, SignalProtocol } from './types';
import {
  AccountPlatformCard,
  PlatformMetricsCard,
  HyperliquidCard,
  PolymarketCard,
  TokenPlatformCard,
  UserHeader,
} from './shared/cards';
import {
  boundPlatforms,
  popoverLayout,
  type CategoryTab,
  type PlatformCategory,
} from './platforms';
import { platformMarkSrc } from '@/shared/platform-brand';
import { createLogger } from './logger';
import { hostPrefersDark } from './host-theme';
import { hoverCardToPopoverData } from './social-card-map';
import { PopoverSkeleton, PopoverError } from './name-tag-popover-states';
import { PopoverTotalsRow } from './name-tag-popover-totals';
import { hasServedTotals } from './shared/totals';
import { getHoverCard } from './hover-card-store';
import { positionFloating } from './shared/floating-position';
import { attachDismissWatcher } from './shared/dismiss';
import popoverCss from './name-tag-popover.css?inline';

import popoverV2Css from './name-tag-popover-v2.css?inline';
import { createShadowHost } from './shared/shadow-host';

type ExpandedCard = SignalProtocol | null;
type PopoverStatus = 'idle' | 'loading' | 'loaded' | 'error';

type SelectedAccounts = Partial<Record<SignalProtocol, number>>;
type SelectedPeriods = Partial<Record<SignalProtocol, string>>;

const FIRST_ACCOUNT_SELECTED: SelectedAccounts = {};
const DEFAULT_PERIOD = 'ALL';

const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

const ALL_SIGNAL_PROTOCOLS: SignalProtocol[] = ['hyperliquid', 'polymarket', 'fomo', 'pumpfun'];

export async function loadPopoverData(twitterId: string): Promise<SignalPopoverData> {
  const result = await getHoverCard(twitterId);
  if (!result) {
    throw new Error('hover-card returned no data');
  }
  return hoverCardToPopoverData(result);
}

type PopoverEntry = {
  load: () => Promise<SignalPopoverData>;

  resolveProfile?: () => SignalProfileSnapshot | undefined;
  data?: SignalPopoverData;
  inflight?: Promise<SignalPopoverData>;

  platforms?: SignalProtocol[];
};

function PlatformBlock(props: {
  protocol: SignalProtocol;
  data: SignalPopoverData;
  expanded: Accessor<ExpandedCard>;
  periods: Accessor<SelectedPeriods>;
  selectedAccount: Accessor<SelectedAccounts>;
  onToggle: (card: SignalProtocol) => void;
  onSelectAccount: (card: SignalProtocol, index: number) => void;
  onSelectPeriod: (card: SignalProtocol, period: string) => void;
}): JSX.Element {
  const p = props.protocol;
  const period = () => props.periods()[p] ?? DEFAULT_PERIOD;
  const expanded = () => props.expanded() === p;
  const selected = () => props.selectedAccount()[p] ?? 0;
  const onSelect = (index: number) => props.onSelectAccount(p, index);
  const onToggle = () => props.onToggle(p);
  const onSelectPeriod = (value: string) => props.onSelectPeriod(p, value);
  return (
    <Switch>
      <Match keyed when={p === 'hyperliquid' && props.data.hyperliquid}>
        {(hl) => (
          <HyperliquidCard
            metrics={props.data.platformMetrics?.[p]}
            data={hl}
            expanded={expanded()}
            period={period()}
            selected={selected()}
            onSelect={onSelect}
            onToggle={onToggle}
            onSelectPeriod={onSelectPeriod}
          />
        )}
      </Match>
      <Match keyed when={p === 'polymarket' && props.data.polymarket}>
        {(pm) => (
          <PolymarketCard
            metrics={props.data.platformMetrics?.[p]}
            data={pm}
            expanded={expanded()}
            period={period()}
            selected={selected()}
            onSelect={onSelect}
            onToggle={onToggle}
            onSelectPeriod={onSelectPeriod}
          />
        )}
      </Match>
      <Match keyed when={(p === 'fomo' || p === 'pumpfun') && props.data[p]}>
        {(summary) => (
          <TokenPlatformCard
            metrics={props.data.platformMetrics?.[p]}
            data={summary}
            expanded={expanded()}
            selected={selected()}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        )}
      </Match>
      <Match
        keyed
        when={
          p !== 'hyperliquid' &&
          p !== 'polymarket' &&
          p !== 'fomo' &&
          p !== 'pumpfun' &&
          props.data[p]
        }
      >
        {(summary) => (
          <AccountPlatformCard
            data={summary}
            period={period()}
            onSelectPeriod={onSelectPeriod}
            metrics={props.data.platformMetrics?.[p]}
            expanded={expanded()}
            selected={selected()}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        )}
      </Match>
      <Match keyed when={!props.data[p] && props.data.platformMetrics?.[p]}>
        {(metrics) => <PlatformMetricsCard protocol={p} metrics={metrics} />}
      </Match>
    </Switch>
  );
}

function CategoryTabs(props: {
  tabs: CategoryTab[];
  active: PlatformCategory;
  onSelect: (category: PlatformCategory) => void;
}): JSX.Element {
  return (
    <div class="signal-popover__cattabs" role="tablist">
      <For each={props.tabs}>
        {(tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab.category === props.active}
            class={`signal-popover__cattab${tab.category === props.active ? ' signal-popover__cattab--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              props.onSelect(tab.category);
            }}
          >
            <span>{tab.label}</span>
            <span class="signal-popover__cattab-marks" aria-hidden="true">
              <For each={tab.platforms}>
                {(platform) => (
                  <img src={platformMarkSrc(platform)} data-platform={platform} alt="" />
                )}
              </For>
            </span>
          </button>
        )}
      </For>
    </div>
  );
}

function PopoverPanel(props: {
  ref: (el: HTMLDivElement) => void;
  profile: Accessor<SignalProfileSnapshot | undefined>;
  status: Accessor<PopoverStatus>;
  data: Accessor<SignalPopoverData | null>;

  platforms: Accessor<SignalProtocol[]>;
  expanded: Accessor<ExpandedCard>;

  periods: Accessor<SelectedPeriods>;
  selectedAccount: Accessor<SelectedAccounts>;
  category: Accessor<PlatformCategory | null>;
  onToggle: (card: SignalProtocol) => void;
  onSelectAccount: (card: SignalProtocol, index: number) => void;
  onSelectPeriod: (card: SignalProtocol, period: string) => void;
  onSelectCategory: (category: PlatformCategory) => void;
  onRetry: () => void;
}): JSX.Element {
  const layout = createMemo(() => {
    const data = props.data();
    return data ? popoverLayout(boundPlatforms(data), data.platformCategories) : null;
  });
  const tabs = createMemo((): CategoryTab[] => {
    const current = layout();
    return current?.kind === 'tabs' ? current.tabs : [];
  });
  const activeTab = createMemo(
    () => tabs().find((t) => t.category === props.category()) ?? tabs()[0],
  );
  const shown = (): SignalProtocol[] => {
    const current = layout();
    if (!current) return [];
    return current.kind === 'flat' ? current.platforms : (activeTab()?.platforms ?? []);
  };
  return (
    <div class="signal-popover" role="dialog" ref={props.ref}>
      <Show when={props.profile()}>
        {(profile) => (
          <UserHeader
            profile={profile()}
            bioPending={() => props.status() === 'idle' || props.status() === 'loading'}
            bio={() => props.data()?.bio}
          />
        )}
      </Show>
      {}
      <Show
        when={
          props.status() === 'loaded' &&
          (hasServedTotals(props.data()?.totals) || props.data()?.referralTotals?.referredVolume)
        }
      >
        <PopoverTotalsRow
          totals={props.data()?.totals}
          referredVolume={props.data()?.referralTotals?.referredVolume}
        />
      </Show>
      <div
        class="signal-popover__body"
        aria-busy={props.status() === 'loading' ? 'true' : undefined}
      >
        <Switch>
          <Match when={props.status() === 'loading'}>
            <PopoverSkeleton platforms={props.platforms} />
          </Match>
          <Match when={props.status() === 'error'}>
            <PopoverError onRetry={props.onRetry} />
          </Match>
          <Match when={props.status() === 'loaded' && props.data()}>
            {(data) => (
              <>
                <Show when={activeTab()}>
                  {(tab) => (
                    <CategoryTabs
                      tabs={tabs()}
                      active={tab().category}
                      onSelect={props.onSelectCategory}
                    />
                  )}
                </Show>
                <div class="signal-popover__platforms">
                  <For each={shown()}>
                    {(protocol) => (
                      <PlatformBlock
                        protocol={protocol}
                        data={data()}
                        expanded={props.expanded}
                        periods={props.periods}
                        selectedAccount={props.selectedAccount}
                        onToggle={props.onToggle}
                        onSelectAccount={props.onSelectAccount}
                        onSelectPeriod={props.onSelectPeriod}
                      />
                    )}
                  </For>
                </div>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export class NameTagPopover {
  private readonly logger = createLogger('popover');
  private readonly document: Document;
  private readonly window: Window;
  private readonly entries = new WeakMap<HTMLElement, PopoverEntry>();

  private rootEl: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private dispose: (() => void) | null = null;
  private currentTag: HTMLElement | null = null;

  private status!: Accessor<PopoverStatus>;
  private setStatus!: Setter<PopoverStatus>;
  private data!: Accessor<SignalPopoverData | null>;
  private setData!: Setter<SignalPopoverData | null>;
  private platforms!: Accessor<SignalProtocol[]>;
  private setPlatforms!: Setter<SignalProtocol[]>;
  private expanded!: Accessor<ExpandedCard>;
  private setExpanded!: Setter<ExpandedCard>;
  private periods!: Accessor<SelectedPeriods>;
  private setPeriods!: Setter<SelectedPeriods>;
  private category!: Accessor<PlatformCategory | null>;
  private setCategory!: Setter<PlatformCategory | null>;
  private selectedAccount!: Accessor<SelectedAccounts>;
  private setSelectedAccount!: Setter<SelectedAccounts>;
  private profile!: Accessor<SignalProfileSnapshot | undefined>;
  private setProfile!: Setter<SignalProfileSnapshot | undefined>;

  private hoverRects: { tag: DOMRect; pop: DOMRect } | null = null;

  private pointerInsidePopover = false;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopDismissWatcher: (() => void) | null = null;

  private onOpenHook?: () => void;

  constructor(doc: Document = document) {
    this.document = doc;
    this.window = doc.defaultView ?? window;
    [this.status, this.setStatus] = createSignal<PopoverStatus>('idle');
    [this.data, this.setData] = createSignal<SignalPopoverData | null>(null);
    [this.platforms, this.setPlatforms] = createSignal<SignalProtocol[]>(ALL_SIGNAL_PROTOCOLS);
    [this.expanded, this.setExpanded] = createSignal<ExpandedCard>(null);
    [this.periods, this.setPeriods] = createSignal<SelectedPeriods>({});
    [this.category, this.setCategory] = createSignal<PlatformCategory | null>(null);
    [this.selectedAccount, this.setSelectedAccount] =
      createSignal<SelectedAccounts>(FIRST_ACCOUNT_SELECTED);
    [this.profile, this.setProfile] = createSignal<SignalProfileSnapshot | undefined>(undefined);
  }

  setOnOpen(cb: () => void): void {
    this.onOpenHook = cb;
  }

  register(
    tag: HTMLElement,
    load: () => Promise<SignalPopoverData>,
    resolveProfile?: () => SignalProfileSnapshot | undefined,
  ): void {
    const existing = this.entries.get(tag);
    this.entries.set(tag, {
      load,
      resolveProfile,
      data: existing?.data,
      inflight: existing?.inflight,
      platforms: existing?.platforms,
    });
    tag.addEventListener('mouseenter', this.onTagEnter);
    tag.addEventListener('mouseleave', this.onTagLeave);
  }

  updatePlatforms(tag: HTMLElement, protocols: SignalProtocol[]): void {
    const entry = this.entries.get(tag);
    if (!entry) return;
    entry.platforms = protocols;
    if (this.currentTag === tag && this.status() === 'loading') {
      this.setPlatforms(protocols);

      this.position(tag.getBoundingClientRect());
    }
  }

  unregister(tag: HTMLElement): void {
    tag.removeEventListener('mouseenter', this.onTagEnter);
    tag.removeEventListener('mouseleave', this.onTagLeave);
    this.entries.delete(tag);
    if (this.currentTag === tag) this.close();
  }

  private onTagEnter = (event: Event): void => {
    const tag = event.currentTarget as HTMLElement;
    this.cancelClose();
    if (this.currentTag === tag && this.rootEl?.classList.contains('signal-popover--open')) {
      return;
    }
    this.cancelOpen();
    this.openTimer = setTimeout(() => this.open(tag), OPEN_DELAY);
  };

  private onTagLeave = (): void => {
    this.cancelOpen();
  };

  private onPointerMove = (event: MouseEvent): void => {
    const rects = this.hoverRects;
    this.pointerInsidePopover = !!rects && this.withinRect(rects.pop, event.clientX, event.clientY);
    if (this.pointerInside(event.clientX, event.clientY)) {
      this.cancelClose();
    } else {
      this.scheduleClose();
    }
  };

  private withinRect(r: DOMRect, x: number, y: number): boolean {
    const T = 8;
    return x >= r.left - T && x <= r.right + T && y >= r.top - T && y <= r.bottom + T;
  }

  private pointerInside(x: number, y: number): boolean {
    const rects = this.hoverRects;
    if (!rects) return false;
    return this.withinRect(rects.pop, x, y) || this.withinRect(rects.tag, x, y);
  }

  private open(tag: HTMLElement): void {
    const entry = this.entries.get(tag);
    if (!entry) return;
    this.onOpenHook?.();

    this.cancelClose();

    try {
      this.ensureElement();
      this.currentTag = tag;
      this.setPeriods({});
      this.setCategory(null);
      this.pointerInsidePopover = false;

      this.rootEl!.classList.toggle('signal-popover--dark', hostPrefersDark(this.document));

      this.setProfile(entry.resolveProfile?.());

      this.setSelectedAccount(FIRST_ACCOUNT_SELECTED);

      if (entry.data) {
        this.setData(entry.data);
        this.setStatus('loaded');
        this.setExpanded(null);
      } else {
        this.setData(null);
        this.setPlatforms(entry.platforms ?? ALL_SIGNAL_PROTOCOLS);
        this.setStatus('loading');
        this.setExpanded(null);
        this.loadInto(tag, entry);
      }

      this.position(tag.getBoundingClientRect());
      this.scrollToExpandedCard();
      this.rootEl!.classList.add('signal-popover--open');
      this.attachViewportListeners();
    } catch (error) {
      this.logger.error('failed to open popover', error);
    }
  }

  private loadInto(tag: HTMLElement, entry: PopoverEntry): void {
    if (entry.inflight) return;

    const promise = entry.load();
    entry.inflight = promise;

    promise.then(
      (data) => {
        entry.data = data;
        entry.inflight = undefined;
        if (this.currentTag !== tag || !this.isOpen()) return;
        this.setData(data);
        this.setStatus('loaded');
        this.setExpanded(null);
        this.position(tag.getBoundingClientRect());
        this.scrollToExpandedCard();
      },
      (error) => {
        entry.inflight = undefined;
        this.logger.error('failed to load popover data', error);
        if (this.currentTag !== tag || !this.isOpen()) return;
        this.setStatus('error');
        this.position(tag.getBoundingClientRect());
      },
    );
  }

  private isOpen(): boolean {
    return this.rootEl?.classList.contains('signal-popover--open') ?? false;
  }

  private toggle = (card: SignalProtocol): void => {
    this.setExpanded((prev) => (prev === card ? null : card));
    if (this.currentTag) this.position(this.currentTag.getBoundingClientRect());
  };

  private selectAccount = (card: SignalProtocol, index: number): void => {
    this.setSelectedAccount((prev) => ({ ...prev, [card]: index }));
    this.setExpanded(card);

    if (this.currentTag) this.position(this.currentTag.getBoundingClientRect());
  };

  private selectPeriod = (card: SignalProtocol, period: string): void => {
    this.setPeriods((prev) => (prev[card] === period ? prev : { ...prev, [card]: period }));
  };

  private selectCategory = (category: PlatformCategory): void => {
    this.setCategory(category);
    this.setExpanded(null);
    const list = this.rootEl?.querySelector<HTMLElement>('.signal-popover__platforms');
    if (list) list.scrollTop = 0;
    if (this.currentTag) this.position(this.currentTag.getBoundingClientRect());
  };

  private scrollToExpandedCard(): void {
    const root = this.rootEl;
    if (!root) return;
    const list = root.querySelector<HTMLElement>('.signal-popover__platforms');
    const card = this.expanded();
    root.scrollTop = 0;
    if (!list) return;
    const target = card ? list.querySelector<HTMLElement>(`.signal-popover__card--${card}`) : null;
    list.scrollTop = target ? Math.max(0, target.offsetTop - list.offsetTop) : 0;
  }

  private retry = (): void => {
    const tag = this.currentTag;
    const entry = tag ? this.entries.get(tag) : undefined;
    if (tag && entry) {
      this.setPlatforms(entry.platforms ?? ALL_SIGNAL_PROTOCOLS);
      this.setStatus('loading');
      this.loadInto(tag, entry);
      this.position(tag.getBoundingClientRect());
    }
  };

  close = (): void => {
    if (!this.rootEl) return;
    this.rootEl.classList.remove('signal-popover--open');
    this.currentTag = null;
    this.setExpanded(null);
    this.hoverRects = null;
    this.pointerInsidePopover = false;
    this.detachViewportListeners();
  };

  private ensureElement(): HTMLElement {
    if (this.rootEl) return this.rootEl;
    const { host, shadow } = createShadowHost(popoverCss + '\n' + popoverV2Css);
    this.dispose = render(
      () => (
        <PopoverPanel
          ref={(el) => (this.rootEl = el)}
          profile={this.profile}
          status={this.status}
          data={this.data}
          platforms={this.platforms}
          expanded={this.expanded}
          periods={this.periods}
          selectedAccount={this.selectedAccount}
          category={this.category}
          onToggle={this.toggle}
          onSelectAccount={this.selectAccount}
          onSelectPeriod={this.selectPeriod}
          onSelectCategory={this.selectCategory}
          onRetry={this.retry}
        />
      ),
      shadow,
    );
    this.document.body.appendChild(host);
    this.host = host;
    return this.rootEl!;
  }

  private position(tagRect: DOMRect): void {
    const root = this.rootEl;
    if (!root) return;

    const { left, top } = positionFloating(
      tagRect,
      { width: root.offsetWidth, height: root.offsetHeight },
      this.window,
    );
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;

    this.hoverRects = { tag: tagRect, pop: root.getBoundingClientRect() };
  }

  private attachViewportListeners(): void {
    this.document.addEventListener('mousemove', this.onPointerMove);
    this.stopDismissWatcher = attachDismissWatcher(this.window, this.document, () => this.rootEl, {
      onScroll: () => {
        if (this.pointerInsidePopover) return;
        this.close();
      },
      onResize: () => this.close(),
    });
  }

  private detachViewportListeners(): void {
    this.document.removeEventListener('mousemove', this.onPointerMove);
    this.stopDismissWatcher?.();
    this.stopDismissWatcher = null;
  }

  private cancelOpen(): void {
    if (this.openTimer !== undefined) {
      clearTimeout(this.openTimer);
      this.openTimer = undefined;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
  }

  private scheduleClose(): void {
    this.cancelClose();
    this.closeTimer = setTimeout(this.close, CLOSE_DELAY);
  }

  destroy(): void {
    this.cancelOpen();
    this.cancelClose();
    this.detachViewportListeners();
    this.dispose?.();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.rootEl = null;
    this.currentTag = null;
    this.setData(null);
    this.setExpanded(null);
  }
}
