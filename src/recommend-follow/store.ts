import { createSignal } from 'solid-js';
import { sendKaitoMessage } from '@/signal/messaging';
import {
  activityInsightsConsentItem,
  followRecommendationCacheItem,
  recommendFollowLocallyFollowedItem,
} from '@/shared/storage';
import type { ExtensionMeResponse } from '@/shared/contracts';
import { pruneLocallyFollowed, type FollowRecommendationResponse } from '@/shared/recommend-follow';

export type RecommendationViewState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }

  | { kind: 'empty'; totalViewSeconds: number | null }
  | { kind: 'emptyNoTwitterBinding' }
  | { kind: 'list'; response: FollowRecommendationResponse };

const [view, setView] = createSignal<RecommendationViewState>({ kind: 'loading' });
export { view };

const [viewer, setViewer] = createSignal<ExtensionMeResponse | undefined>(undefined);
export { viewer };

export type ConsentState = 'loading' | 'unset' | 'granted' | 'declined';
const [consent, setConsent] = createSignal<ConsentState>('loading');
export { consent };

activityInsightsConsentItem.watch((value) => setConsent(value));

export type TermsGateState = 'loading' | 'required' | 'accepted';
const [termsGate, setTermsGate] = createSignal<TermsGateState>('loading');
export { termsGate };

function resolveTermsFromMe(me: ExtensionMeResponse | undefined): TermsGateState {
  if (me && 'termsAccepted' in me && me.termsAccepted === false) return 'required';
  return 'accepted';
}

async function resolveConsentFromMe(me: ExtensionMeResponse | undefined): Promise<'unset' | 'granted' | 'declined'> {
  if (!me || !('activityInsightsEnabled' in me)) {
    return activityInsightsConsentItem.getValue();
  }
  const enabled = me.activityInsightsEnabled;
  const resolved = enabled === true ? 'granted' : enabled === false ? 'declined' : 'unset';
  await activityInsightsConsentItem.setValue(resolved);
  return resolved;
}

const [locallyFollowedIds, setLocallyFollowedIds] = createSignal<ReadonlySet<string>>(new Set());
export { locallyFollowedIds };

async function refreshLocallyFollowed(): Promise<void> {
  const raw = await recommendFollowLocallyFollowedItem.getValue();
  const pruned = pruneLocallyFollowed(raw, Date.now());
  setLocallyFollowedIds(new Set(Object.keys(pruned)));

  if (Object.keys(pruned).length !== Object.keys(raw).length) {
    await recommendFollowLocallyFollowedItem.setValue(pruned);
  }
}

recommendFollowLocallyFollowedItem.watch(() => void refreshLocallyFollowed());

export function isStaticEmptyState(): boolean {
  const current = view();
  if (current.kind === 'empty' || current.kind === 'emptyNoTwitterBinding') return true;
  return current.kind === 'list' && current.response.items.every((item) => locallyFollowedIds().has(item.twitterId));
}

function toViewState(response: FollowRecommendationResponse): RecommendationViewState {
  if (response.items.length > 0) return { kind: 'list', response };
  if (response.reason === 'no_twitter_binding') return { kind: 'emptyNoTwitterBinding' };
  return { kind: 'empty', totalViewSeconds: response.totalViewSeconds ?? null };
}

async function fetchFresh(): Promise<void> {
  const response = await sendKaitoMessage({
    target: 'kaitoExtension',
    action: 'getFollowRecommendations',
  });

  if (response.result) {
    await followRecommendationCacheItem.setValue(response.result);
    setView(toViewState(response.result));
    return;
  }

  await settleToCacheOrEmpty();
}

async function settleToCacheOrEmpty(): Promise<void> {
  try {
    const cached = await followRecommendationCacheItem.getValue();
    setView(cached ? toViewState(cached) : { kind: 'empty', totalViewSeconds: null });
  } catch {
    setView({ kind: 'empty', totalViewSeconds: null });
  }
}

async function resolveList(): Promise<void> {
  const cached = await followRecommendationCacheItem.getValue();
  if (cached) {
    setView(toViewState(cached));
    if (Date.now() < cached.nextRefreshAt) return;
  }
  await fetchFresh();
}

export async function syncConsentFromMe(me: ExtensionMeResponse | undefined): Promise<void> {
  setTermsGate(resolveTermsFromMe(me));
  setConsent(await resolveConsentFromMe(me));
}

export async function initRecommendations(): Promise<void> {
  try {
    await resolveInitialView();
  } catch (error) {
    console.warn('[recommend-follow] initRecommendations failed', error);
    await settleToCacheOrEmpty();
  }
}

async function resolveInitialView(): Promise<void> {
  console.log('[TIMING] initRecommendations start', performance.now());
  setView({ kind: 'loading' });

  const stateResponse = await sendKaitoMessage({
    target: 'kaitoExtension',
    action: 'getState',
  });
  console.log('[TIMING] getState response received', performance.now());
  if (!stateResponse.state.signedIn) {
    setView({ kind: 'signedOut' });
    return;
  }
  setViewer(stateResponse.state.me);
  void refreshLocallyFollowed();

  setTermsGate(resolveTermsFromMe(stateResponse.state.me));
  setConsent(await resolveConsentFromMe(stateResponse.state.me));
  if (stateResponse.state.me?.twitterId == null) {

    setView({ kind: 'emptyNoTwitterBinding' });
    return;
  }

  console.log('[TIMING] before fetchFresh', performance.now());
  await resolveList();
  console.log('[TIMING] after fetchFresh', performance.now());
}

export async function signOut(): Promise<void> {
  const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'signOut' });
  if (response.ok) {
    setViewer(undefined);
    setView({ kind: 'signedOut' });
  }
}

async function setActivityInsightsPreference(enabled: boolean): Promise<void> {
  await activityInsightsConsentItem.setValue(enabled ? 'granted' : 'declined');
  const response = await sendKaitoMessage({
    target: 'kaitoExtension',
    action: 'setActivityInsightsPreference',
    enabled,
  });
  if (!response.result) {
    console.warn('[activity-insights] setActivityInsightsPreference failed, keeping optimistic local value', response.error);
  }
}

export async function enableActivityInsights(): Promise<void> {
  await setActivityInsightsPreference(true);
  await fetchFresh();
}

export async function acceptTermsAndEnter(activityData: boolean): Promise<void> {
  const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'acceptTerms' });
  if (!response.result) {
    console.warn('[terms] acceptTerms failed — sheet stays up for retry', response.error);
    return;
  }
  if (activityData) {
    await activityInsightsConsentItem.setValue('granted');
  } else await setActivityInsightsPreference(false);
  setTermsGate('accepted');
  await fetchFresh();
}

export async function disableActivityInsights(): Promise<void> {
  await setActivityInsightsPreference(false);
}
