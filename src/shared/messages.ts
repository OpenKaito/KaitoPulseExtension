import type { AuraSummaryResponse } from './aura-summary';
import type { TradingSummaryResponse } from './trading-summary';
import type {
  AcceptTermsResponse,
  ActivityInsightsPreference,
  Attestation,
  ExtensionMeResponse,
  ExtensionProof,
  ExtensionVerifier,
  ListPlatformBindingsResponse,
  SubmitProofResponse,
  UnbindPlatformResponse,
} from './contracts';
import type { SignalSelectorKey, ProfileSelectorKey } from '@/signal/dom/selectors';
import type { AdFlagQueryItem, AdFlagWriteResult } from './ad-flag';
import type { BadgeItem, HoverCardResult } from './social-card';
import type { ExtensionSocialCardActivityResponse, ExtensionSocialSummary } from './extension-social';
import type { SocialCardBundle, SocialCardScope } from './voices-social-card';
import type { DebugRequestSnapshot } from './debug';
import type { BehaviorEvent, BehaviorEventSnapshot } from './behavior';
import type { AttentionBehaviorEvent, AttentionFingerprint, AttentionServeEvent } from './attention';
import type { PendingAuthIntent } from './storage';
import type { FollowRecommendationResponse } from './recommend-follow';
import type { TokenChartPeriod, TokenChartResult } from './token-chart';
import type { CashtagOccurrence, ResolvedTicker } from './ticker-resolve';

export type SelectorOverridePayload = {
  version: number;
  signal: Partial<Record<SignalSelectorKey, string>>;
  profile: Partial<Record<ProfileSelectorKey, string>>;
};

type NoPayload = Record<never, never>;

export type KaitoMessageContract = {
  init: { payload: NoPayload; response: GetStateResponse };
  getState: { payload: NoPayload; response: GetStateResponse };

  startProof: {
    payload: { verifierId: string; tabId?: number; ownerWindowId?: number };
    response: StartProofResponse;
  };

  cancelProof: { payload: NoPayload; response: CancelProofResponse };

  openVerifyWindow: {
    payload: { verifierId: string };
    response: OpenVerifyWindowResponse;
  };

  returnFromVerifyWindow: {
    payload: { windowId?: number };
    response: ReturnFromVerifyWindowResponse;
  };

  listPlatformBindings: { payload: NoPayload; response: ListPlatformBindingsResponse };
  unbindPlatform: {
    payload: { platform: string };
    response: UnbindPlatformMessageResponse;
  };
  signOut: { payload: NoPayload; response: SignOutResponse };
  resetSession: { payload: NoPayload; response: ResetSessionResponse };
  exportLastAttestation: { payload: NoPayload; response: ExportLastAttestationResponse };
  getDebugRequests: { payload: NoPayload; response: GetDebugRequestsResponse };
  clearDebugRequests: { payload: NoPayload; response: ClearDebugRequestsResponse };

  recordBehaviorEvents: {
    payload: { events: BehaviorEvent[] };
    response: RecordBehaviorEventsResponse;
  };
  getBehaviorEvents: { payload: NoPayload; response: GetBehaviorEventsResponse };
  clearBehaviorEvents: { payload: NoPayload; response: ClearBehaviorEventsResponse };

  recordAttentionEvents: {
    payload: {
      events: AttentionBehaviorEvent[];
      serveEvents: AttentionServeEvent[];
      fp: AttentionFingerprint;
    };
    response: RecordAttentionEventsResponse;
  };

  fetchImage: {
    payload: { url: string; width: number };
    response: FetchImageResponse;
  };

  fetchRawImage: {
    payload: { url: string };
    response: FetchImageResponse;
  };

  fetchBadges: { payload: { twitterIds: string[] }; response: FetchBadgesResponse };
  fetchHoverCard: { payload: { twitterId: string }; response: FetchHoverCardResponse };

  getSocialSummary: { payload: NoPayload; response: GetSocialSummaryResponse };

  getSocialCardActivity: { payload: NoPayload; response: GetSocialCardActivityResponse };

  getSocialCard: {
    payload: { twitterId: string; candidates?: SocialCardScope[] };
    response: GetSocialCardResponse;
  };
  fetchTokenChart: {
    payload: { symbol: string; period: TokenChartPeriod; entity?: string };
    response: FetchTokenChartResponse;
  };

  resolveTickers: { payload: { occurrences: CashtagOccurrence[] }; response: FetchResolveTickersResponse };

  putAdFlag: {
    payload: { tweetId: string; reason: string };
    response: AdFlagWriteResponse;
  };
  removeAdFlag: { payload: { tweetId: string }; response: AdFlagWriteResponse };
  queryAdFlags: {
    payload: { tweetIds: string[] };
    response: AdFlagQueryMessageResponse;
  };

  getSelectorOverrides: { payload: NoPayload; response: GetSelectorOverridesResponse };
  forceRefreshSelectorOverrides: {
    payload: NoPayload;
    response: ForceRefreshSelectorOverridesResponse;
  };

  getProofPanelState: { payload: { href: string }; response: ProofPanelStateResponse };

  openSignIn: { payload: { url: string }; response: OpenSignInResponse };

  openOptions: { payload: NoPayload; response: OpenOptionsResponse };

  getFollowRecommendations: {
    payload: NoPayload;
    response: GetFollowRecommendationsResponse;
  };

  getAuraSummary: {
    payload: NoPayload;
    response: GetAuraSummaryResponse;
  };

  getTradingSummary: {
    payload: NoPayload;
    response: GetTradingSummaryResponse;
  };
  followFromRecommendation: {
    payload: { twitterId: string; handle: string };
    response: FollowFromRecommendationResponse;
  };
  setActivityInsightsPreference: {
    payload: { enabled: boolean };
    response: SetActivityInsightsPreferenceResponse;
  };

  getTradingTotalsPublic: {
    payload: NoPayload;
    response: GetTradingTotalsPublicResponse;
  };
  setTradingTotalsPublic: {
    payload: { enabled: boolean };
    response: SetTradingTotalsPublicResponse;
  };

  acceptTerms: {
    payload: NoPayload;
    response: AcceptTermsActionResponse;
  };

  recordAuthIntent: {
    payload: { contextId: string; intent: Omit<PendingAuthIntent, 'createdAt'> };
    response: RecordAuthIntentResponse;
  };
  takeAuthIntent: {
    payload: { contextId: string; kind: PendingAuthIntent['kind'] };
    response: TakeAuthIntentResponse;
  };

  cancelAuthIntent: {
    payload: { contextId: string; kind: PendingAuthIntent['kind'] };
    response: CancelAuthIntentResponse;
  };
};

export type KaitoAction = keyof KaitoMessageContract;

export type MessageFor<A extends KaitoAction> = { target: 'kaitoExtension'; action: A } &
  KaitoMessageContract[A]['payload'];

export type RuntimeRequest = { [A in KaitoAction]: MessageFor<A> }[KaitoAction];

export type AuthIntentRequest = Extract<
  RuntimeRequest,
  { action: 'recordAuthIntent' | 'takeAuthIntent' | 'cancelAuthIntent' }
>;

export type ResponseFor<A extends KaitoAction> = KaitoMessageContract[A]['response'];

export type ReplyFor<A extends KaitoAction> = ResponseFor<A> & Partial<RuntimeThrownResponse>;

export const EXTERNAL_PROTOCOL_VERSION = 1;

export const EXTERNAL_CAPABILITIES = [
  'signIn',
  'signOut',
  'ping',
  'getCapabilities',
  'getVerifyStatus',
  'openVerification',
  'openSurface',
  'invalidate',
  'accountLinked',
  'connect',
] as const;

export type ExternalSurface = 'popup' | 'options' | 'verify';

export type ExternalInvalidateKey = 'me' | 'verifiers' | 'verifications' | 'recommendations';

type ExternalRequestMessage =

  | { type: 'signIn'; accessToken: string; idToken: string; kaitoName?: string; kaitoUserId?: string }

  | { type: 'signOut' }
  | { type: 'ping' }

  | { type: 'getCapabilities' }

  | { type: 'getVerifyStatus' }
  | { type: 'openVerification'; verifierId: string }

  | { type: 'openSurface'; surface: ExternalSurface; params?: { verifierId?: string } }

  | { type: 'invalidate'; keys: ExternalInvalidateKey[] }

  | { type: 'accountLinked'; method: string };

export type ExternalRequest = ExternalRequestMessage & { requestId?: string };

export type ProofRunSummary = {
  verifierId: string;
  requestId: string;
  proofId?: string;
  extractedValue?: string;
  unit?: string;
  verifiedAt?: number;

  finishedAt?: number;
  attestation?: Attestation;
  error?: { message: string; status?: number; reason?: string; code?: ProofErrorCode; retryable?: boolean };
};

export type ProofStage =
  | 'preparing'
  | 'opening_page'
  | 'reading_data'
  | 'generating_proof'
  | 'submitting';

export type ProofErrorCode =
  | 'sign_in_required'
  | 'session_invalid'
  | 'third_party_login_required'
  | 'wallet_not_connected'
  | 'page_closed'
  | 'page_interrupted'
  | 'timeout'
  | 'target_data_missing'
  | 'unsupported_account_type'
  | 'missing_required_data'
  | 'insufficient_activity'
  | 'target_api_changed'
  | 'target_page_not_ready'
  | 'proof_capture_failed'
  | 'proof_engine_stalled'
  | 'verification_already_running'
  | 'duplicate_proof'

  | 'platform_account_already_claimed'

  | 'platform_account_id_missing'
  | 'security_check_failed'
  | 'network_error'
  | 'proof_quota_exhausted'
  | 'unknown_error';

export type ProofProgress = {
  verifierId: string;
  stage: ProofStage;
  message: string;
  startedAt: number;
  targetTabId?: number;
  guideUrl?: string;
};

export type WorkerState = {
  status: 'uninitialized' | 'registering' | 'idle' | 'attesting' | 'submitting' | 'error';
  signedIn: boolean;
  me?: ExtensionMeResponse;
  verifiers: ExtensionVerifier[];

  verifications: Record<string, ExtensionProof>;
  proofProgress?: ProofProgress;
  lastResult?: ProofRunSummary;
  lastError?: string;
};

export type StartProofResponse = {
  ok: boolean;
  result?: ProofRunSummary;
  state: WorkerState;
};

export type SignOutResponse = { ok: boolean; state: WorkerState };
export type GetStateResponse = { state: WorkerState };
export type ResetSessionResponse = { state: WorkerState };
export type ExternalSignInResponse = { ok: boolean; me?: ExtensionMeResponse; reason?: string };

export type CancelProofResponse = { ok: boolean; accepted: boolean; state: WorkerState };
export type ExportLastAttestationResponse = { attestation?: Attestation };

export type UnbindPlatformMessageResponse = UnbindPlatformResponse & { state: WorkerState };

export type RuntimeThrownResponse = { error: string; state: WorkerState };

export type ProofPanelStateResponse =
  | { phase: 'idle' }
  | { phase: 'progress'; progress: ProofProgress; verifierId: string }
  | { phase: 'result'; result: ProofRunSummary; verifierId: string };

export type ExternalVerifyStatusResponse = {
  ok: boolean;
  installed: true;
  signedIn: boolean;

  verifiers: Array<{ id: string; name: string; platform: string }>;

  activeVerifierId?: string;

  progress?: { stage: ProofStage; message: string; startedAt: number };

  verifications: Record<string, { verifiedAt: number; expiresAt?: number }>;

  lastResult?: ExternalLastResult;
  reason?: string;
};

export type ExternalLastResult = {
  verifierId: string;
  ok: boolean;

  finishedAt: number;
  error?: { message: string; reason?: string; code?: ProofErrorCode };
};

export function toExternalLastResult(summary: ProofRunSummary | undefined): ExternalLastResult | undefined {

  if (!summary || typeof summary.finishedAt !== 'number') return undefined;
  return {
    verifierId: summary.verifierId,
    ok: !summary.error,
    finishedAt: summary.finishedAt,
    error: summary.error
      ? { message: summary.error.message, reason: summary.error.reason, code: summary.error.code }
      : undefined,
  };
}

export type ExternalOpenVerificationResponse = { ok: boolean; opened?: boolean; reason?: string };
export type ExternalAccountLinkedResponse = { ok: boolean; reason?: string };
export type ExternalSignOutResponse = { ok: boolean; reason?: string };

export type ExternalOpenSurfaceResponse = { ok: boolean; opened?: boolean; reason?: string };

export type ExternalInvalidateResponse = {
  ok: boolean;
  refreshed?: ExternalInvalidateKey[];
  reason?: string;
};

export type ExternalPingResponse = {
  ok: true;
  protocolVersion: number;
  extensionVersion: string;
};

export type ExternalCapabilitiesResponse = ExternalPingResponse & {
  capabilities: string[];
};

export type ExternalUnsupportedResponse = {
  ok: false;
  reason: 'unsupported_method';
  protocolVersion: number;
  capabilities: string[];
};

export type ExternalPushEvent =
  | { kind: 'hello'; protocolVersion: number; extensionVersion: string; capabilities: string[] }
  | { kind: 'signedIn'; me?: ExtensionMeResponse }
  | { kind: 'signedOut' }
  | { kind: 'accountLinked'; method: string };

export type SubmitProofPayload = SubmitProofResponse;

export type RuntimeErrorResponse = { ok?: false; error: string };
export type RecordAuthIntentResponse = { ok: true } | RuntimeErrorResponse;
export type TakeAuthIntentResponse =
  | { ok: true; intent: PendingAuthIntent | null }
  | RuntimeErrorResponse;
export type CancelAuthIntentResponse =
  | { ok: true; canceled: boolean }
  | RuntimeErrorResponse;
export type OpenVerifyWindowResponse = { ok: true } | RuntimeErrorResponse;
export type ReturnFromVerifyWindowResponse = { ok: true } | RuntimeErrorResponse;
export type OpenSignInResponse = { ok: true } | RuntimeErrorResponse;
export type OpenOptionsResponse = { ok: true } | RuntimeErrorResponse;

export type FetchImageResponse = { dataUri?: string; error?: string };

export type FetchBadgesResponse = { items: Record<string, BadgeItem | null>; error?: string };
export type FetchHoverCardResponse = { result?: HoverCardResult; error?: string };

export type GetSocialCardResponse = { bundle?: SocialCardBundle | null; error?: string };

export type GetSocialSummaryResponse = {
  result?: ExtensionSocialSummary;
  error?: string;
  status?: number;
};

export type GetSocialCardActivityResponse = {
  result?: ExtensionSocialCardActivityResponse;
  error?: string;
  status?: number;
};
export type FetchTokenChartResponse = { result?: TokenChartResult; error?: string };
export type FetchResolveTickersResponse = { resolved: ResolvedTicker[]; error?: string };

export type AdFlagWriteResponse = { result?: AdFlagWriteResult; error?: string; status?: number };
export type AdFlagQueryMessageResponse = { items?: Record<string, AdFlagQueryItem>; error?: string };

export type GetSelectorOverridesResponse = { payload: SelectorOverridePayload | null };
export type ForceRefreshSelectorOverridesResponse = { payload: SelectorOverridePayload | null };

export type GetDebugRequestsResponse = DebugRequestSnapshot;
export type ClearDebugRequestsResponse = DebugRequestSnapshot;

export type GetFollowRecommendationsResponse = {
  result?: FollowRecommendationResponse;
  error?: string;
  status?: number;
};
export type FollowFromRecommendationResponse = { ok: boolean; error?: string };

export type GetAuraSummaryResponse = {
  result?: AuraSummaryResponse;
  error?: string;
  status?: number;
};

export type GetTradingSummaryResponse = {
  result?: TradingSummaryResponse;
  error?: string;
  status?: number;
};

export type SetActivityInsightsPreferenceResponse = {
  result?: ActivityInsightsPreference;
  error?: string;
  status?: number;
};

export type GetTradingTotalsPublicResponse = {
  enabled?: boolean | null;
  error?: string;
  status?: number;
};

export type SetTradingTotalsPublicResponse = {
  result?: ActivityInsightsPreference;
  error?: string;
  status?: number;
};

export type AcceptTermsActionResponse = {
  result?: AcceptTermsResponse;
  error?: string;
  status?: number;
};

export type RecordBehaviorEventsResponse = { ok: true };
export type GetBehaviorEventsResponse = BehaviorEventSnapshot;
export type ClearBehaviorEventsResponse = BehaviorEventSnapshot;
export type RecordAttentionEventsResponse = { ok: true };
