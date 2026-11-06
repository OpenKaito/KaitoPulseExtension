import { api } from '@/lib/api';
import type {
  GetActivityFeedConfigResponse,
  GetActivityFeedPostsResponse,
  GetActivityFeedResponse,
} from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import type { ActivityFeedPage, ActivityFeedPostsPage } from '@/shared/activity-feed';
import { toAuthedError } from './authed-error';
import { createFirstPageReuse } from './first-page-reuse';
import { authedCall } from './worker-core';

const logger = createLogger('activity-feed');
const firstPage = createFirstPageReuse<ActivityFeedPage>(60_000);
const firstPostsPage = createFirstPageReuse<ActivityFeedPostsPage>(60_000);

export async function handleGetActivityFeedConfig(): Promise<GetActivityFeedConfigResponse> {
  try {
    return { result: await authedCall((token) => api.getActivityFeedConfig(token)) };
  } catch (error) {
    logger.error('getActivityFeedConfig error', error);
    return toAuthedError(error, 'activity feed config fetch failed');
  }
}

export async function handleGetActivityFeed(before?: string): Promise<GetActivityFeedResponse> {
  try {
    return {
      result: await authedCall((token) =>
        before
          ? api.getActivityFeed(token, before)
          : firstPage.get(token, () => api.getActivityFeed(token)),
      ),
    };
  } catch (error) {
    logger.error('getActivityFeed error', error);
    return toAuthedError(error, 'activity feed fetch failed');
  }
}

export async function handleGetActivityFeedPosts(
  before?: string,
): Promise<GetActivityFeedPostsResponse> {
  try {
    return {
      result: await authedCall((token) =>
        before
          ? api.getActivityFeedPosts(token, before)
          : firstPostsPage.get(token, () => api.getActivityFeedPosts(token)),
      ),
    };
  } catch (error) {
    logger.error('getActivityFeedPosts error', error);
    return toAuthedError(error, 'activity feed posts fetch failed');
  }
}
