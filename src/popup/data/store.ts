
import { createSignal } from 'solid-js';
import { sendKaitoMessage } from '@/signal/messaging';
import { meCacheItem } from '@/shared/storage';
import type { ExtensionMeResponse } from '@/shared/contracts';
import type { WorkerState } from '@/shared/messages';
import { syncConsentFromMe } from '@/recommend-follow/store';
import { roundAura, type AuraSummaryResponse } from '@/shared/aura-summary';
import type { HoverCardResult } from '@/shared/social-card';
import { withHoverCard } from './from-hover-card';
import { withSocialFollowers } from './from-social-summary';
import { withTradingSummary } from './from-trading-summary';
import type { ExtensionSocialCard, ExtensionSocialFollower } from '@/shared/extension-social';
import { scopeFromCategoryKey, type SocialCardBundle, type SocialCardScope } from '@/shared/voices-social-card';
import { toSocialCardData, type SocialCardData } from '../social-card/view-model';
import { bundleFromSummaryCardData } from '../social-card/from-summary';
import { SOCIAL_CARD_ENABLED } from '../social-card/enabled';
import { ensureCardFonts } from '../social-card/fonts';
import type { TradingSummaryResponse } from '@/shared/trading-summary';
import type { FollowRecommendationResponse } from '@/shared/recommend-follow';
import { EMPTY_DATA } from './empty';

import { updateMockConfig, watchMockConfig, type MockScenario } from '@/mock/settings';
import {
  validateFixtures,
  FIXTURE_DATA,
  FIXTURE_RECOMMENDATIONS,
  FIXTURE_SOCIAL_CARD,
  FIXTURE_SOCIAL_CARD_LINKS,
} from '@/mock/popup-data';
import type { PopupData } from './types';

export type FixtureScenario = MockScenario;

const [scenario, setScenario] = createSignal<FixtureScenario>('live');
export { scenario, setScenario };

export function watchMockScenario(): () => void {
  if (!import.meta.env.DEV) return () => {};

  return watchMockConfig((config) => applyScenario(config.popup));
}

const [data, setData] = createSignal<PopupData>(EMPTY_DATA);
export { data as popupData };

const [workerState, setWorkerState] = createSignal<WorkerState | undefined>(undefined);
export { workerState };

const [gateResolved, setGateResolved] = createSignal(false);
export { gateResolved };

const [auraLoadingRaw, setAuraLoading] = createSignal(true);
const [cardLoadingRaw, setCardLoading] = createSignal(true);
const [tradeLoadingRaw, setTradeLoading] = createSignal(true);

export const fixturesActive = (): boolean => import.meta.env.DEV && scenario() === 'data';

const auraLoading = (): boolean => auraLoadingRaw() && !fixturesActive();
const cardLoading = (): boolean => cardLoadingRaw() && !fixturesActive();
const tradeLoading = (): boolean => tradeLoadingRaw() && !fixturesActive();
export { auraLoading, cardLoading, tradeLoading };

export function fixtureRecommendations(): FollowRecommendationResponse | undefined {
  return import.meta.env.DEV && scenario() === 'data' ? FIXTURE_RECOMMENDATIONS : undefined;
}

export const signedIn = (): boolean => workerState()?.signedIn === true;

export const viewer = (): ExtensionMeResponse | undefined => workerState()?.me;

export const xLinked = (): boolean => fixturesActive() || !!viewer()?.twitterId;

export const tradingVerified = (): boolean =>
  fixturesActive() || Object.keys(workerState()?.verifications ?? {}).length > 0;

export const auraOnboarded = (): boolean => {

  if (import.meta.env.DEV && scenario() !== 'live') return scenario() !== 'onboarding';
  return auraSummary()?.onboarded !== false;
};

function withViewerIdentity(base: PopupData, me: ExtensionMeResponse | undefined): PopupData {
  if (!me) return base;
  return {
    ...base,
    profile: {
      ...base.profile,
      username: me.kaitoName || me.username || base.profile.username,
      handle: me.username ? `@${me.username}` : base.profile.handle,
      avatarUrl: me.avatarUrl || base.profile.avatarUrl,
    },
  };
}

const [auraSummary, setAuraSummary] = createSignal<AuraSummaryResponse | undefined>(undefined);
export { auraSummary };

const [hoverCard, setHoverCard] = createSignal<HoverCardResult | undefined>(undefined);
export { hoverCard };

const [tradingSummary, setTradingSummary] = createSignal<TradingSummaryResponse | undefined>(undefined);
export { tradingSummary };

const [socialCardRaw, setSocialCard] = createSignal<SocialCardData | undefined>(undefined);

export const socialCard = (): SocialCardData | undefined =>
  import.meta.env.DEV && scenario() === 'data' ? FIXTURE_SOCIAL_CARD : socialCardRaw();

const [socialCardLinksRaw, setSocialCardLinks] = createSignal<ExtensionSocialCard | undefined>(undefined);

const [socialFollowers, setSocialFollowers] = createSignal<ExtensionSocialFollower[] | undefined>(undefined);

export const socialCardLinks = (): ExtensionSocialCard | undefined =>
  import.meta.env.DEV && scenario() === 'data' ? FIXTURE_SOCIAL_CARD_LINKS : socialCardLinksRaw();

const [tradingTotalsPublic, setTradingTotalsPublic] = createSignal<boolean | null | undefined>(undefined);
export { tradingTotalsPublic };

const [visibilityLoadingRaw, setVisibilityLoading] = createSignal(true);

export const visibilityLoading = (): boolean => visibilityLoadingRaw() && !fixturesActive();

export async function saveTradingTotalsPublic(enabled: boolean): Promise<boolean> {
  try {
    const response = await sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'setTradingTotalsPublic',
      enabled,
    });
    if (!response.result) return false;
    setTradingTotalsPublic(response.result.enabled);
    return true;
  } catch {

    return false;
  }
}

export async function signOut(): Promise<void> {
  const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'signOut' });
  if (!response.ok) return;
  setWorkerState(response.state);

  setAuraSummary(undefined);
  setHoverCard(undefined);
  setTradingSummary(undefined);
  setTradingTotalsPublic(undefined);

  setSocialCard(undefined);
  setSocialCardLinks(undefined);

  setSocialFollowers(undefined);

  recompute();
}

function withAuraSummary(
  base: PopupData,
  summary: AuraSummaryResponse | undefined,
  onboarded: boolean,
): PopupData {
  if (!summary) return base;
  return {
    ...base,
    profile: {
      ...base.profile,

      aura: onboarded ? roundAura(summary.total) : null,
      auraDelta: onboarded ? base.profile.auraDelta : null,
    },
    aura: {
      ...base.aura,
      total: roundAura(summary.total),
      earned: roundAura(summary.earned.total),
      referral: roundAura(summary.referral.total),
      rank: summary.rank?.rank ?? null,

      inviteUrl: summary.invite?.shortUrl ?? null,
      inviteCode: summary.invite?.code ?? null,
    },
  };
}

function recompute(): void {

  if (import.meta.env.DEV && scenario() === 'data') {

    validateFixtures();
    setData(FIXTURE_DATA);
    return;
  }
  let next = withViewerIdentity(EMPTY_DATA, viewer());
  const card = hoverCard();
  if (card) next = withHoverCard(next, card);

  next = withSocialFollowers(next, socialFollowers());

  next = withTradingSummary(next, tradingSummary(), card);
  setData(withAuraSummary(next, auraSummary(), auraOnboarded()));
}

export function selectScenario(next: FixtureScenario): void {
  applyScenario(next);
  if (import.meta.env.DEV) void updateMockConfig({ popup: next });
}

function applyScenario(next: FixtureScenario): void {
  setScenario(next);
  recompute();
}

async function loadSocialCard(twitterId: string | undefined): Promise<void> {
  try {

    if (!twitterId) return;
    void ensureCardFonts();
    const candidates = (hoverCard()?.smartFollowers?.categories ?? [])
      .map((category) => scopeFromCategoryKey(category.key))
      .filter((scope): scope is SocialCardScope => scope !== null);
    const response = await sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'getSocialCard',
      twitterId,
      candidates,
    });

    if (response.bundle) setSocialCard(toSocialCardData(response.bundle) ?? undefined);
  } catch {

  }
}

async function loadSocialCardActivity(bundle: SocialCardBundle): Promise<void> {
  try {
    const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'getSocialCardActivity' });
    const activity = response.result?.activity;
    if (!activity) return;
    setSocialCard(toSocialCardData({ ...bundle, activity }) ?? undefined);
  } catch {

  }
}

async function loadSocialSummary(): Promise<boolean> {
  try {
    if (SOCIAL_CARD_ENABLED) void ensureCardFonts();
    const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'getSocialSummary' });

    if (!response.result) return false;
    setSocialCardLinks(response.result.socialCard);

    setSocialFollowers(response.result.followers);
    recompute();

    if (!SOCIAL_CARD_ENABLED) return false;
    const bundle = bundleFromSummaryCardData(response.result.socialCard.data);
    if (!bundle) return false;
    setSocialCard(toSocialCardData(bundle) ?? undefined);

    void loadSocialCardActivity(bundle);
    return true;
  } catch {

    return false;
  }
}

let popupDataLoading = false;
let popupDataRerunPending = false;

function identityKey(me: ExtensionMeResponse | null | undefined): string | undefined {
  return me?.privyId || me?.twitterId || me?.username || me?.email || undefined;
}

let lastIdentityKey: string | undefined;

export function watchPopupSession(): () => void {
  return meCacheItem.watch((me) => {
    const next = identityKey(me);
    if (next === lastIdentityKey) return;
    lastIdentityKey = next;
    if (popupDataLoading) {
      popupDataRerunPending = true;
      return;
    }
    void initPopupData();
  });
}

export async function initPopupData(): Promise<void> {
  popupDataLoading = true;
  try {
    const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'getState' });
    setWorkerState(response.state);

    lastIdentityKey = identityKey(response.state.me);

    recompute();

    await syncConsentFromMe(response.state.me);

    setGateResolved(true);

    const twitterId = response.state.me?.twitterId;

    const summaryLoad = loadSocialSummary();

    await Promise.all([
      (async () => {
        try {

          const aura = await sendKaitoMessage({ target: 'kaitoExtension', action: 'getAuraSummary' });
          if (aura.result) setAuraSummary(aura.result);
        } catch {

        } finally {
          setAuraLoading(false);
          recompute();
        }
      })(),
      (async () => {
        try {
          if (twitterId) {
            const card = await sendKaitoMessage({ target: 'kaitoExtension', action: 'fetchHoverCard', twitterId });
            if (card.result) setHoverCard(card.result);
          }
        } catch {

        } finally {
          setCardLoading(false);
          recompute();
        }

        if (!SOCIAL_CARD_ENABLED) return;
        if (await summaryLoad) return;
        await loadSocialCard(twitterId);
      })(),

      summaryLoad,
      (async () => {
        try {

          const trading = await sendKaitoMessage({ target: 'kaitoExtension', action: 'getTradingSummary' });
          if (trading.result) setTradingSummary(trading.result);
        } catch {

        } finally {
          setTradeLoading(false);
          recompute();
        }
      })(),
      (async () => {
        try {

          const visibility = await sendKaitoMessage({
            target: 'kaitoExtension',
            action: 'getTradingTotalsPublic',
          });

          if ('enabled' in visibility) setTradingTotalsPublic(visibility.enabled);
        } catch {

        } finally {
          setVisibilityLoading(false);
        }
      })(),
    ]);
  } catch {

  } finally {
    recompute();

    setGateResolved(true);

    setAuraLoading(false);
    setCardLoading(false);
    setTradeLoading(false);
    setVisibilityLoading(false);
    popupDataLoading = false;
    if (popupDataRerunPending) {
      popupDataRerunPending = false;
      void initPopupData();
    }
  }
}
