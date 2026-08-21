
export type AttentionClickKind =
  | 'detail'
  | 'outbound'
  | 'media'
  | 'quoted'
  | 'like'
  | 'unlike'
  | 'retweet'
  | 'unretweet'
  | 'reply'
  | 'bookmark'
  | 'removeBookmark';

export interface AttentionGeo {
  viewportW: number;
  viewportH: number;
  scrollY: number;
  tweetTop: number;
  tweetHeight: number;
}

export interface AttentionBehaviorEvent {
  eventId: string;

  type: 'impression' | 'click' | 'follow' | 'unfollow' | 'presence';

  tweetId: string;

  authorHandle: string | null;

  authorTwitterId: string | null;

  targetTwitterId: string | null;
  isPromoted: boolean;
  truncated: boolean;
  tsStart: number;
  tsEnd: number;
  dwellMs: number;
  clickKind: AttentionClickKind | null;
  geo: AttentionGeo;
  pageUrl: string;

  tabId: string | null;
}

export interface AttentionServeEvent {
  tweetId: string;
  authorHandle: string | null;

  authorTwitterId: string | null;
  servedAt: number;
  sourceOp: string;
  entryKind: 'tweet' | 'retweet' | 'promoted';
}

export interface AttentionFingerprint {
  ua: string;
  platform: string;
  languages: string[];
  timezone: string;
  screenW: number;
  screenH: number;
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory: number | null;

  canvasHash: string | null;

  webglVendor: string | null;

  webglRenderer: string | null;

  webglHash: string | null;

  audioHash: string | null;
}

export interface AttentionBatchContext {
  sessionUrl: string;
  extVersion: string;
  fp: AttentionFingerprint;
}

export interface AttentionEventBatch {
  batchId: string;
  schemaVersion: 1;
  sentAt: number;
  context: AttentionBatchContext;
  behaviorEvents: AttentionBehaviorEvent[];
  serveEvents: AttentionServeEvent[];
}

export interface AttentionEventBatchResponse {
  accepted: string[];
  rejected: { eventId: string; reason: string }[];
}

export interface AttentionConfigResponse {
  collectEnabled: boolean;
  serveSetEnabled: boolean;
  operationAllowlist: string[];
  flushPeriodSec: number;
  maxBatchEvents: number;
}

export const DEFAULT_ATTENTION_CONFIG: AttentionConfigResponse = {
  collectEnabled: true,
  serveSetEnabled: true,
  operationAllowlist: [
    'HomeTimeline', 'HomeLatestTimeline', 'TweetDetail', 'UserTweets',
    'UserTweetsAndReplies', 'SearchTimeline', 'ListLatestTweetsTimeline', 'Bookmarks',
  ],
  flushPeriodSec: 30,
  maxBatchEvents: 500,
};

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeAttentionConfig(raw: unknown): AttentionConfigResponse {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<AttentionConfigResponse>;
  const allowlist = obj.operationAllowlist;
  const allowlistOk = Array.isArray(allowlist) && allowlist.every((op) => typeof op === 'string');
  return {
    collectEnabled:
      typeof obj.collectEnabled === 'boolean' ? obj.collectEnabled : DEFAULT_ATTENTION_CONFIG.collectEnabled,
    serveSetEnabled:
      typeof obj.serveSetEnabled === 'boolean' ? obj.serveSetEnabled : DEFAULT_ATTENTION_CONFIG.serveSetEnabled,
    operationAllowlist: allowlistOk ? allowlist : DEFAULT_ATTENTION_CONFIG.operationAllowlist,
    flushPeriodSec: isPositiveFinite(obj.flushPeriodSec)
      ? obj.flushPeriodSec
      : DEFAULT_ATTENTION_CONFIG.flushPeriodSec,
    maxBatchEvents: isPositiveFinite(obj.maxBatchEvents)
      ? obj.maxBatchEvents
      : DEFAULT_ATTENTION_CONFIG.maxBatchEvents,
  };
}

const ATTENTION_ROUTE_ROOTS: ReadonlySet<string> = new Set([
  'home', 'explore', 'notifications', 'messages', 'search', 'settings', 'compose',
  'bookmarks', 'lists', 'topics', 'communities', 'hashtag', 'jobs', 'i',
  'login', 'logout', 'tos', 'privacy', 'intent', 'status',
]);

function collapseRouteSegment(segment: string): string {

  if (/^\d+$/.test(segment)) return ':id';
  if (/^[0-9a-z_-]{16,}$/i.test(segment)) return ':id';
  return segment.toLowerCase();
}

export function sanitizePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return `${url.origin}/`;
    const [first, ...rest] = segments;
    const head = ATTENTION_ROUTE_ROOTS.has(first.toLowerCase()) ? first.toLowerCase() : ':user';

    if (head === 'messages') return `${url.origin}/messages`;
    return `${url.origin}/${[head, ...rest.map(collapseRouteSegment)].join('/')}`;
  } catch {
    return '';
  }
}

export function createAttentionEventId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
