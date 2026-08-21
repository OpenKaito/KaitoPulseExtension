
import { storage } from 'wxt/utils/storage';
import type { Attestation, ExtensionMeResponse, ExtensionProof, ExtensionVerifier } from '@/shared/contracts';
import type { ProofProgress, ProofRunSummary } from '@/shared/messages';
import type { StoredSession } from '@/lib/client-storage';
import type { ViewerIdentity } from '@/shared/viewer';
import type { SignalSettings } from '@/signal/settings';
import type { SelectorOverridePayload } from '@/shared/messages';
import type { BehaviorEvent } from '@/shared/behavior';
import type {
  AttentionBehaviorEvent,
  AttentionConfigResponse,
  AttentionFingerprint,
  AttentionServeEvent,
} from '@/shared/attention';
import type { FollowRecommendationResponse, LocallyFollowedMap } from '@/shared/recommend-follow';

export const sessionItem = storage.defineItem<StoredSession | null>('local:kaito.session');

export const meCacheItem = storage.defineItem<ExtensionMeResponse | null>('local:kaito.me');

export const lastResultItem = storage.defineItem<ProofRunSummary | null>('local:kaito.lastResult');

export const lastAttestationItem = storage.defineItem<Attestation | null>('local:kaito.lastAttestation');

export const activeProofProgressItem = storage.defineItem<ProofProgress | null>('local:kaito.activeProofProgress');

export interface VerifySnapshot {
  verifiers: ExtensionVerifier[];
  verifications: Record<string, ExtensionProof>;
}
export const verifySnapshotItem = storage.defineItem<VerifySnapshot | null>('local:kaito.verifySnapshot');

export type PendingAuthIntentKind = 'ad-flag-submit' | 'ad-flag-remove' | 'verify-start';
export interface PendingAuthIntent {
  kind: PendingAuthIntentKind;
  params: Record<string, string>;
  createdAt: number;
}

export interface StoredPendingAuthIntent extends PendingAuthIntent {
  ownerTabId: number;
  ownerContextId: string;
}

export type PendingAuthIntentMap = Partial<Record<PendingAuthIntentKind, StoredPendingAuthIntent>>;
export const pendingAuthIntentsItem = storage.defineItem<PendingAuthIntentMap>(
  'session:kaito.pendingAuthIntents',
  { fallback: {} },
);

export const deviceFingerprintItem = storage.defineItem<string | null>('local:kaito.deviceFingerprint');

export const viewerItem = storage.defineItem<ViewerIdentity | null>('local:kaito.viewer');

export const signalSettingsItem = storage.defineItem<SignalSettings>('local:kaito.signal.settings', {
  fallback: {},
});

export const selectorOverridesItem = storage.defineItem<SelectorOverridePayload | null>(
  'local:kaito.signal.selectorOverrides',
);

export const behaviorEventsItem = storage.defineItem<BehaviorEvent[]>('local:kaito.behavior.events', {
  fallback: [],
});

export const activityInsightsConsentItem = storage.defineItem<'unset' | 'granted' | 'declined'>(
  'local:kaito.behavior.consent',
  { fallback: 'unset' },
);

export const debugUnlockedItem = storage.defineItem<boolean>('local:kaito.options.debugUnlocked', {
  fallback: false,
});

export const attnPendingEventsItem = storage.defineItem<AttentionBehaviorEvent[]>(
  'local:kaito.attn.pendingEvents',
  { fallback: [] },
);
export const attnPendingServeEventsItem = storage.defineItem<AttentionServeEvent[]>(
  'local:kaito.attn.pendingServeEvents',
  { fallback: [] },
);

export interface AttentionUploadCursor {

  nextRetryAt: number;

  backoffLevel: number;
}
export const attnCursorItem = storage.defineItem<AttentionUploadCursor>('local:kaito.attn.cursor', {
  fallback: { nextRetryAt: 0, backoffLevel: 0 },
});

export const attnFingerprintItem = storage.defineItem<AttentionFingerprint | null>(
  'local:kaito.attn.fingerprint',
  { fallback: null },
);

export interface AttentionRemoteConfig extends AttentionConfigResponse {
  fetchedAt: number;
}
export const attnRemoteConfigItem = storage.defineItem<AttentionRemoteConfig | null>(
  'local:kaito.attn.remoteConfig',
  { fallback: null },
);

export const attnPausedAuthItem = storage.defineItem<boolean>('local:kaito.attn.pausedAuth', {
  fallback: false,
});

export interface AttentionOpenSpanSnapshot {
  spans: { tweetId: string; tsStart: number }[];
  lastSeenAt: number;
}
export const attnOpenSpanSnapshotItem = storage.defineItem<AttentionOpenSpanSnapshot | null>(
  'local:kaito.attn.openSpanSnapshot',
  { fallback: null },
);

export const followRecommendationCacheItem = storage.defineItem<FollowRecommendationResponse | null>(
  'local:kaito.recommendFollow.cache',
  { fallback: null },
);

export const recommendFollowLocallyFollowedItem = storage.defineItem<LocallyFollowedMap>(
  'local:kaito.recommendFollow.locallyFollowed',
  { fallback: {} },
);
