import type { AuraSummaryResponse } from '@/shared/aura-summary';
import type { TradingSummaryResponse } from '@/shared/trading-summary';
import { ENV, logDev } from './env';
import { buildClientHeaders } from './client-headers';
import {
  AcceptTermsResponse,
  ActivityInsightsPreference,
  ApiError,
  Attestation,
  CreateSessionResponse,
  ExtensionMeResponse,
  ExtensionVerifier,
  ListAutoVerificationsResponse,
  ListPlatformBindingsResponse,
  ListPreferencesResponse,
  ListProofsResponse,
  UnbindPlatformResponse,
  SignResponse,
  SubmitProofResponse,
} from '@/shared/contracts';
import type { AdFlagQueryResponse, AdFlagWriteResult } from '@/shared/ad-flag';
import type { BadgesResponse, HoverCardResult } from '@/shared/social-card';
import type { ExtensionSocialCardActivityResponse, ExtensionSocialSummary } from '@/shared/extension-social';
import type {
  SocialCardScope,
  VoicesSmartEngagementActivity,
  VoicesSocialCardDetails,
  VoicesSocialCardOverview,
} from '@/shared/voices-social-card';
import type { CashtagOccurrence, TickerResolveResponse } from '@/shared/ticker-resolve';
import type { TickerChartResponse } from '@/shared/token-chart';
import type { AttentionConfigResponse, AttentionEventBatch, AttentionEventBatchResponse } from '@/shared/attention';
import type { FollowActionReport, FollowRecommendationResponse } from '@/shared/recommend-follow';
import { finishDebugRequest, startDebugRequest } from '@/background/debug-log';

type RequestOptions = {
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  body?: unknown;
  sessionToken?: string;
  accessToken?: string;
  idToken?: string;
  expectNoContent?: boolean;

  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || (options.body !== undefined ? 'POST' : 'GET');
  return requestInner<T>(path, method, options);
}

async function requestInner<T>(
  path: string,
  method: 'DELETE' | 'GET' | 'POST' | 'PUT',
  options: RequestOptions,
): Promise<T> {
  const url = `${ENV.apiBaseUrl}${path}`;
  const debugId = startDebugRequest({
    source: 'extension-api',
    method,
    url,
    path,
    requestBody: options.body,
  });
  const headers: Record<string, string> = { ...(await buildClientHeaders()) };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.sessionToken) {
    headers.authorization = `Bearer ${options.sessionToken}`;
  }
  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }
  if (options.idToken) {
    headers['Privy-id-token'] = options.idToken;
  }

  const signal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    logDev('network error', path, error);
    finishDebugRequest(debugId, {
      ok: false,
      error: `network_error: ${(error as Error).message}`,
    });
    throw new ApiError(0, undefined, `network_error: ${(error as Error).message}`);
  }

  if (options.expectNoContent && response.status === 204) {
    finishDebugRequest(debugId, { status: response.status, ok: true });
    return undefined as T;
  }

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    logDev('body read error', path, error);
    finishDebugRequest(debugId, {
      status: response.status,
      ok: false,
      error: `network_error: ${(error as Error).message}`,
    });
    throw new ApiError(0, undefined, `network_error: ${(error as Error).message}`);
  }
  let body: unknown = undefined;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    let messagePart: string;
    if (typeof body === 'object' && body !== null) {
      const obj = body as Record<string, unknown>;
      messagePart = String(obj.reason || obj.message || obj.error || response.statusText || 'unknown');
    } else if (typeof body === 'string' && body.length > 0) {
      messagePart = body;
    } else {
      messagePart = response.statusText || 'unknown';
    }
    const message = `${options.method || 'GET'} ${path} ${response.status}: ${messagePart}`;
    logDev('api error', message, body);
    finishDebugRequest(debugId, {
      status: response.status,
      ok: false,
      responseBody: body,
      error: message,
    });
    throw new ApiError(
      response.status,
      body as ApiError['body'],
      message,
    );
  }

  finishDebugRequest(debugId, {
    status: response.status,
    ok: true,
    responseBody: body,
  });
  return body as T;
}

export const api = {
  createSession(accessToken: string, idToken: string): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('/api/v1/extension/sessions', {
      method: 'POST',
      accessToken,
      idToken,
    });
  },
  getMe(sessionToken: string): Promise<ExtensionMeResponse> {
    return request<ExtensionMeResponse>('/api/v1/extension/me', { sessionToken });
  },
  acceptTerms(sessionToken: string): Promise<AcceptTermsResponse> {
    return request<AcceptTermsResponse>('/api/v1/extension/terms/accept', {
      method: 'POST',
      sessionToken,
    });
  },
  getVerifiers(sessionToken: string): Promise<ExtensionVerifier[]> {
    return request<ExtensionVerifier[]>('/api/v1/extension/verifiers', { sessionToken });
  },
  getAutoVerifications(sessionToken: string): Promise<ListAutoVerificationsResponse> {
    return request<ListAutoVerificationsResponse>('/api/v1/extension/auto-verifications', { sessionToken });
  },
  getProofs(sessionToken: string): Promise<ListProofsResponse> {
    return request<ListProofsResponse>('/api/v1/extension/proofs', { sessionToken });
  },
  getPlatformBindings(sessionToken: string): Promise<ListPlatformBindingsResponse> {
    return request<ListPlatformBindingsResponse>('/api/v1/extension/bindings', { sessionToken });
  },

  unbindPlatform(sessionToken: string, platform: string): Promise<UnbindPlatformResponse> {
    return request<UnbindPlatformResponse>(`/api/v1/extension/bindings/${encodeURIComponent(platform)}`, {
      method: 'DELETE',
      sessionToken,
    });
  },
  enableAutoVerification(sessionToken: string, verifierId: string): Promise<void> {
    return request<void>(`/api/v1/extension/auto-verifications/${encodeURIComponent(verifierId)}`, {
      method: 'POST',
      sessionToken,
    });
  },
  signRequest(sessionToken: string, verifierId: string): Promise<SignResponse> {
    return request<SignResponse>('/api/v1/extension/sign', {
      method: 'POST',
      body: { verifierId },
      sessionToken,
    });
  },
  submitProof(sessionToken: string, requestId: string, attestation: Attestation): Promise<SubmitProofResponse> {
    return request<SubmitProofResponse>('/api/v1/extension/proof/submit', {
      method: 'POST',
      body: { requestId, attestation },
      sessionToken,
    });
  },

  reportProofFailure(
    sessionToken: string,
    body: { requestId: string; code: string; reason?: string; message?: string; stage?: string },
  ): Promise<{ ok: true }> {
    return request<{ ok: true }>('/api/v1/extension/proof/fail', {
      method: 'POST',
      body,
      sessionToken,
    });
  },
  revokeSession(sessionToken: string): Promise<void> {
    return request<void>('/api/v1/extension/sessions/current', {
      method: 'DELETE',
      sessionToken,
      expectNoContent: true,
    });
  },

  getBadges(twitterIds: string[], sessionToken?: string): Promise<BadgesResponse> {
    return request<BadgesResponse>('/api/v1/extension/badges', {
      method: 'POST',
      body: { twitter_ids: twitterIds },
      sessionToken,
    });
  },

  getHoverCard(twitterId: string, sessionToken?: string): Promise<HoverCardResult> {
    const qs = new URLSearchParams({ twitter_id: twitterId });
    return request<HoverCardResult>(`/api/v1/extension/hover-card?${qs.toString()}`, { sessionToken });
  },

  getSocialSummary(sessionToken: string): Promise<ExtensionSocialSummary> {
    return request<ExtensionSocialSummary>('/api/v1/extension/social/summary', { sessionToken });
  },

  getSocialCardActivity(sessionToken: string): Promise<ExtensionSocialCardActivityResponse> {
    return request<ExtensionSocialCardActivityResponse>('/api/v1/extension/social/card/activity', {
      sessionToken,
    });
  },

  getVoicesSocialCardOverview(scope: SocialCardScope, twitterId: string): Promise<VoicesSocialCardOverview> {
    const qs = new URLSearchParams({ user_id: twitterId });
    return request<VoicesSocialCardOverview>(`/api/v1/voices/social_card/${scope}/overview?${qs.toString()}`);
  },
  getVoicesSocialCardDetails(scope: SocialCardScope, twitterId: string): Promise<VoicesSocialCardDetails> {
    const qs = new URLSearchParams({ user_id: twitterId });
    return request<VoicesSocialCardDetails>(`/api/v1/voices/social_card/${scope}/details?${qs.toString()}`);
  },

  getVoicesSocialCardActivity(
    scope: SocialCardScope,
    twitterId: string,
  ): Promise<VoicesSmartEngagementActivity> {
    const qs = new URLSearchParams({ user_id: twitterId });
    return request<VoicesSmartEngagementActivity>(
      `/api/v1/voices/social_card/${scope}/smart_engagement_activity?${qs.toString()}`,
    );
  },

  postAttentionEventBatch(sessionToken: string, batch: AttentionEventBatch): Promise<AttentionEventBatchResponse> {
    return request<AttentionEventBatchResponse>('/api/v1/extension/attention/event-batches', {
      method: 'POST',
      body: batch,
      sessionToken,

      timeoutMs: 20_000,
    });
  },

  getAttentionConfig(sessionToken?: string): Promise<AttentionConfigResponse> {
    return request<AttentionConfigResponse>('/api/v1/extension/attention/config', { sessionToken });
  },

  getFollowRecommendations(sessionToken: string): Promise<FollowRecommendationResponse> {
    return request<FollowRecommendationResponse>('/api/v1/extension/recommendations/follow', { sessionToken });
  },

  getAuraSummary(sessionToken: string): Promise<AuraSummaryResponse> {
    return request<AuraSummaryResponse>('/api/v1/extension/aura/summary', { sessionToken });
  },

  getTradingSummary(sessionToken: string): Promise<TradingSummaryResponse> {
    return request<TradingSummaryResponse>('/api/v1/extension/trading/summary', { sessionToken });
  },

  postFollowAction(sessionToken: string, report: FollowActionReport): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/v1/extension/follows', {
      method: 'POST',
      body: report,
      sessionToken,
    });
  },

  putActivityInsightsPreference(sessionToken: string, enabled: boolean): Promise<ActivityInsightsPreference> {
    return request<ActivityInsightsPreference>('/api/v1/extension/preferences/activity_insights', {
      method: 'PUT',
      body: { enabled },
      sessionToken,
    });
  },

  getPreferences(sessionToken: string): Promise<ListPreferencesResponse> {
    return request<ListPreferencesResponse>('/api/v1/extension/preferences', { sessionToken });
  },

  putTradingTotalsPublic(sessionToken: string, enabled: boolean): Promise<ActivityInsightsPreference> {
    return request<ActivityInsightsPreference>('/api/v1/extension/preferences/trading_totals_public', {
      method: 'PUT',
      body: { enabled },
      sessionToken,
    });
  },

  putAdFlag(sessionToken: string, tweetId: string, reason: string): Promise<AdFlagWriteResult> {
    return request<AdFlagWriteResult>(`/api/v1/extension/tweets/${encodeURIComponent(tweetId)}/ad-flag`, {
      method: 'PUT',
      body: { reason },
      sessionToken,
    });
  },

  removeAdFlag(sessionToken: string, tweetId: string): Promise<AdFlagWriteResult> {
    return request<AdFlagWriteResult>(`/api/v1/extension/tweets/${encodeURIComponent(tweetId)}/ad-flag`, {
      method: 'DELETE',
      sessionToken,
    });
  },

  queryAdFlags(tweetIds: string[], sessionToken?: string): Promise<AdFlagQueryResponse> {
    return request<AdFlagQueryResponse>('/api/v1/extension/tweets/ad-flags/query', {
      method: 'POST',
      body: { tweet_ids: tweetIds },
      sessionToken,
    });
  },

  resolveTickers(occurrences: CashtagOccurrence[], sessionToken?: string): Promise<TickerResolveResponse> {
    return request<TickerResolveResponse>('/api/v1/extension/tickers/resolve', {
      method: 'POST',

      body: { occurrences },
      sessionToken,
    });
  },

  getTickerChart(
    ticker: string,
    duration: string,

    entity?: string,
    sessionToken?: string,
  ): Promise<TickerChartResponse> {
    const qs = new URLSearchParams({ duration });
    if (entity) qs.set('entity', entity);
    return request<TickerChartResponse>(`/api/v1/extension/tickers/${encodeURIComponent(ticker)}/chart?${qs.toString()}`, {
      sessionToken,
    });
  },
};
