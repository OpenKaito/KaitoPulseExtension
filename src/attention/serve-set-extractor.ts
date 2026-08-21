
import type { AttentionServeEvent } from '@/shared/attention';

export const SERVE_SET_MESSAGE = 'kaito-attn-serve-set' as const;

export interface AttentionServeSetMessage {
  source: typeof SERVE_SET_MESSAGE;
  events: AttentionServeEvent[];
}

export const DEFAULT_SERVE_SET_OPERATIONS = new Set([
  'HomeTimeline', 'HomeLatestTimeline', 'TweetDetail', 'UserTweets',
  'UserTweetsAndReplies', 'SearchTimeline', 'ListLatestTweetsTimeline', 'Bookmarks',
]);

const MAX_NODES = 50_000;
const ID_RE = /^\d{1,32}$/;

function readTweetResult(node: Record<string, unknown>): Record<string, unknown> | null {
  const inner = node.tweet_results;
  if (!inner || typeof inner !== 'object') return null;
  const result = (inner as Record<string, unknown>).result;
  if (!result || typeof result !== 'object') return null;
  const resultObj = result as Record<string, unknown>;

  const unwrapped = resultObj.tweet && typeof resultObj.tweet === 'object'
    ? (resultObj.tweet as Record<string, unknown>)
    : resultObj;
  return unwrapped;
}

function readId(obj: Record<string, unknown>): string | null {
  const restId = obj.rest_id;
  if (typeof restId === 'string' && ID_RE.test(restId)) return restId;
  return null;
}

function pickScreenName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const screenName = (value as Record<string, unknown>).screen_name;
  return typeof screenName === 'string' ? screenName.toLowerCase() : null;
}

function readAuthorHandle(tweet: Record<string, unknown>): string | null {
  const userResult = readAuthorUserResult(tweet);
  return pickScreenName(userResult?.legacy) ?? pickScreenName(userResult?.core);
}

function readAuthorTwitterId(tweet: Record<string, unknown>): string | null {
  const userResult = readAuthorUserResult(tweet);
  return userResult ? readId(userResult) : null;
}

function readAuthorUserResult(tweet: Record<string, unknown>): Record<string, unknown> | undefined {
  const core = tweet.core as Record<string, unknown> | undefined;
  const userResults = core?.user_results as Record<string, unknown> | undefined;
  return userResults?.result as Record<string, unknown> | undefined;
}

function readEntryKind(tweet: Record<string, unknown>): AttentionServeEvent['entryKind'] {
  if (tweet.promoted_metadata) return 'promoted';
  const legacy = tweet.legacy as Record<string, unknown> | undefined;
  if (legacy && typeof legacy.retweeted_status_result === 'object') return 'retweet';
  return 'tweet';
}

export function extractServeSet(root: unknown, sourceOp: string): AttentionServeEvent[] {
  const out: AttentionServeEvent[] = [];
  const seen = new Set<string>();
  const stack: unknown[] = [root];
  let budget = MAX_NODES;
  const servedAt = Date.now();

  while (stack.length > 0) {
    if (budget-- <= 0) break;
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }

    const obj = node as Record<string, unknown>;
    const tweet = readTweetResult(obj);
    if (tweet) {
      const id = readId(tweet);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push({
          tweetId: id,
          authorHandle: readAuthorHandle(tweet),
          authorTwitterId: readAuthorTwitterId(tweet),
          servedAt,
          sourceOp,
          entryKind: readEntryKind(tweet),
        });
      }
    }
    for (const key in obj) stack.push(obj[key]);
  }

  return out;
}
