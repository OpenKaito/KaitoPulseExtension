import type {
  FetchBadgesResponse,
  FetchHoverCardResponse,
  GetSocialCardActivityResponse,
  GetSocialCardResponse,
  GetSocialSummaryResponse,
} from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { api } from '@/lib/api';
import { getStoredSession } from '@/lib/client-storage';
import { applyHoverCardMock, watchHoverCardMock } from '@/mock/hover-card';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';
import {
  pickDefaultScope,
  SOCIAL_CARD_SCOPES,
  type SocialCardScope,
  type VoicesSocialCardOverview,
} from '@/shared/voices-social-card';

const logger = createLogger('social-card');

watchHoverCardMock((description) => {
  logger.warn(`⚠️ hover-card totals MOCKED (${description}) — do not treat this as evidence of production behaviour`);
});

const BADGES_BATCH_LIMIT = 50;

export async function handleFetchBadges(twitterIds: string[]): Promise<FetchBadgesResponse> {
  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    return { items: {} };
  }

  const capped = twitterIds.slice(0, BADGES_BATCH_LIMIT);
  if (capped.length < twitterIds.length) {
    logger.warn(`badges batch capped at ${BADGES_BATCH_LIMIT} (got ${twitterIds.length})`);
  }

  try {
    const response = await api.getBadges(capped, stored.sessionToken);
    return { items: response.items };
  } catch (error) {
    logger.error('fetchBadges error', error);
    return { items: {}, error: (error as Error)?.message || 'badges fetch failed' };
  }
}

export async function handleFetchHoverCard(twitterId: string): Promise<FetchHoverCardResponse> {
  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    return { error: 'signed out' };
  }

  try {
    const result = await api.getHoverCard(twitterId, stored.sessionToken);

    return { result: await applyHoverCardMock(twitterId, result) };
  } catch (error) {
    logger.error('fetchHoverCard error', error);
    return { error: (error as Error)?.message || 'hover-card fetch failed' };
  }
}

export async function handleGetSocialCard(
  twitterId: string,
  candidates?: SocialCardScope[],
): Promise<GetSocialCardResponse> {
  const scopes = candidates?.length ? candidates : SOCIAL_CARD_SCOPES;
  let overviewByScope: Partial<Record<SocialCardScope, VoicesSocialCardOverview>>;
  try {

    const settled = await Promise.all(
      scopes.map(async (scope) => {
        try {
          return [scope, await api.getVoicesSocialCardOverview(scope, twitterId)] as const;
        } catch (error) {
          logger.warn(`social-card overview(${scope}) failed`, error);
          return [scope, undefined] as const;
        }
      }),
    );
    overviewByScope = Object.fromEntries(settled.filter(([, v]) => v !== undefined)) as Partial<
      Record<SocialCardScope, VoicesSocialCardOverview>
    >;
  } catch (error) {
    logger.error('getSocialCard overview error', error);
    return { error: (error as Error)?.message || 'social-card overview failed' };
  }

  const scope = pickDefaultScope(overviewByScope, scopes);

  if (!scope) return { bundle: null };
  const overview = overviewByScope[scope];
  if (!overview) return { bundle: null };

  const [details, activity] = await Promise.all([
    api.getVoicesSocialCardDetails(scope, twitterId).catch((error: unknown) => {
      logger.warn(`social-card details(${scope}) failed`, error);
      return undefined;
    }),
    api.getVoicesSocialCardActivity(scope, twitterId).catch((error: unknown) => {
      logger.warn(`social-card activity(${scope}) failed`, error);
      return undefined;
    }),
  ]);

  return { bundle: { scope, overview, details, activity } };
}

export async function handleGetSocialSummary(): Promise<GetSocialSummaryResponse> {
  try {
    const result = await authedCall((token) => api.getSocialSummary(token));
    return { result };
  } catch (error) {
    logger.error('getSocialSummary error', error);
    return toAuthedError(error, 'social summary fetch failed');
  }
}

export async function handleGetSocialCardActivity(): Promise<GetSocialCardActivityResponse> {
  try {
    const result = await authedCall((token) => api.getSocialCardActivity(token));
    return { result };
  } catch (error) {
    logger.error('getSocialCardActivity error', error);
    return toAuthedError(error, 'social card activity fetch failed');
  }
}
