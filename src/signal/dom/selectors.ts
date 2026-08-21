
import { logLocalWarning } from '@/lib/guard';
import DEFAULTS from './selectors.default.json';

export const SIGNAL_DOM_SELECTORS = { ...DEFAULTS.signal };

export const DEFAULT_SIGNAL_DOM_SELECTORS: Readonly<typeof SIGNAL_DOM_SELECTORS> =
  Object.freeze({ ...DEFAULTS.signal });

export const SIGNAL_DOM_ATTRS = {
  AVATAR_INJECTED_FLAG: 'data-signal-avatar-injected',

  AVATAR_HANDLE: 'data-signal-avatar-handle',
  NAMETAG_INJECTED_FLAG: 'data-signal-nametag-injected',
  STATS_INJECTED_FLAG: 'data-signal-stats-injected',
  AD_FLAG_INJECTED_FLAG: 'data-signal-adflag-injected',
  AD_FLAG_NOTICE_INJECTED_FLAG: 'data-signal-adflag-notice-injected',

  SURFACE: 'data-signal-surface',

  FEED_SWEPT: 'data-signal-feed-swept',

  NATIVE_CASHTAG_CARD_HIDDEN: 'data-signal-native-cashtag-hidden',

  CASHTAG_CHIP: 'data-signal-cashtag-chip',

  CASHTAG_SWEPT: 'data-signal-cashtag-swept',
} as const;

export const PROFILE_SELECTORS = { ...DEFAULTS.profile };

export const DEFAULT_PROFILE_SELECTORS: Readonly<typeof PROFILE_SELECTORS> =
  Object.freeze({ ...DEFAULTS.profile });

export const PROFILE_ATTRS = {
  USERNAME_HISTORY_FLAG: 'data-signal-username-history',
  USER_INFO_FLAG: 'data-signal-user-info',
} as const;

export type SignalSelectorKey = keyof typeof DEFAULTS.signal;
export type ProfileSelectorKey = keyof typeof DEFAULTS.profile;

export type SelectorOverrideKey = SignalSelectorKey | ProfileSelectorKey;

export const SIGNAL_SELECTOR_KEYS: ReadonlySet<SignalSelectorKey> =
  new Set(Object.keys(DEFAULTS.signal) as SignalSelectorKey[]);
export const PROFILE_SELECTOR_KEYS: ReadonlySet<ProfileSelectorKey> =
  new Set(Object.keys(DEFAULTS.profile) as ProfileSelectorKey[]);

export const SELECTOR_NOTES: Partial<Record<SelectorOverrideKey, string>> = {
  USER_NAME:
    'Feed display-name block (name + verified badge + @handle + · + timestamp); the name tag is appended next to the timestamp. "User-Name" WITH hyphen — distinct from the profile header\'s "UserName". This is the one key that is COMPOSED into longer selectors by its callers (`:is(${USER_NAME}) a[role="link"][href^="/"]` in dom/adapter.ts, `:is(${USER_NAME}) time` in behavior/dom-helpers.ts) — each wraps it in `:is(...)` specifically so a compound override value ("a, b") still reassociates correctly as `:is(a, b) time` / `:is(a, b) a[role="link"]...` instead of silently reassociating onto only the last comma-separated alternative. Contrast AVATAR / FOLLOW_CONTROL, which are comma-lists composed at the top level (no descendant suffix), where this concern never arises.',
  TWEET_AVATAR:
    'The in-tweet author avatar, and ONLY that — unlike AVATAR it deliberately excludes UserAvatar-Container-*, which the left-nav account switcher also matches on every page including Settings/Messages. That precision is what makes it usable as an independent "a tweet is actually rendered" probe in dom/health-monitor.ts.',
  USER_CELL:
    'Any user cell, anywhere: right-rail & in-feed "Who to follow", /i/connect_people, followers/following, search People, list members.',
  ACCOUNT_SWITCHER:
    'Bottom-left account button (logged-in user). Always present in the left nav on every page.',
  PROFILE_NAV_LINK:
    'Bottom-left "Profile" nav link. Fallback source for the viewer handle when the account-switcher avatar is not mounted yet.',
  HOVER_CARD:
    'x.com native profile hover popup. Freshly mounted per user (new node each time) so our injected-flag idempotency resets naturally.',
  HOVER_CARD_FOLLOWING_LINK:
    'The Following/Followers row inside a hover card — matched by href pattern (/<handle>/following), not a testid (none exists). A handle literally "following" also matches; accepted.',
  AVATAR_CONTAINER:
    'The per-user avatar container x.com mounts as UserAvatar-Container-<handle>. Used to find an avatar root inside a hover card / name link / arbitrary subtree.',
  AVATAR_CONTAINER_KNOWN:
    'As the avatar container but excludes the "unknown" placeholder a hover card shows before it resolves the user — so we never badge an unresolved card avatar.',
  FOLLOW_CONTROL:
    'x.com follow/unfollow control. The testid carries the numeric user id: <id>-follow when you do not follow them, <id>-unfollow when you do — both must match.',
  QUOTED_TWEET:
    'A quoted tweet/X Article embedded in a feed tweet. External-link preview cards share this role=link shape, so callers must filter by avatar presence.',
  PROFILE_USER_NAME:
    'Profile header display-name + @handle block. "UserName" NO hyphen — the feed tweet header uses "User-Name" WITH a hyphen; different element.',
  TABLIST:
    'The Posts/Replies/Highlights tab bar. Used only to locate its enclosing <nav>; the user-info card mounts before that nav, NOT before the tablist (see findTabNavAnchor for why the tablist itself is the wrong anchor).',
  MORE_MENU:
    'The tweet header\'s native "more" (⋯) menu button. Exactly one per article, even when the article embeds a quoted tweet (the quote card renders no menu of its own). The ad-flag trigger is injected as its preceding sibling — see orchestrator.ts\'s injectAdFlagButton for the exact DOM-depth reasoning.',
  SMART_TAG_CARD_LOGO:
    'x.com\'s own cashtag price-summary card (the "$BTC · Crypto · $1.3T MC" module above search results for a recognized ticker) — this is the ONE stable hook inside it, everything else is obfuscated atomic classes. Not inside an <article>, so it never collides with the feed sweep. orchestrator.ts hides the closest ancestor `[data-testid="cellInnerDiv"]` so the native card doesn\'t compete with the Kaito chart popover/chip for the same symbol.',
};

function isValidSelector(value: string): boolean {
  try {
    document.querySelector(value);
    return true;
  } catch {
    return false;
  }
}

const reportedInvalidOverrides = new Set<string>();

function reportInvalidOverride(key: SelectorOverrideKey, value: string): void {
  const dedupeKey = `${key}:${value}`;
  if (reportedInvalidOverrides.has(dedupeKey)) return;
  reportedInvalidOverrides.add(dedupeKey);

  logLocalWarning(`invalid selector override for ${key}`, 'signal.selectorOverrides', { key, value });
}

function applySignalSelectorOverrides(overrides: Partial<Record<SignalSelectorKey, string>>): void {
  for (const key of Object.keys(DEFAULT_SIGNAL_DOM_SELECTORS) as (keyof typeof DEFAULT_SIGNAL_DOM_SELECTORS)[]) {
    const candidate = overrides[key];
    if (candidate !== undefined && isValidSelector(candidate)) {
      SIGNAL_DOM_SELECTORS[key] = candidate;
      continue;
    }
    SIGNAL_DOM_SELECTORS[key] = DEFAULT_SIGNAL_DOM_SELECTORS[key];
    if (candidate !== undefined) reportInvalidOverride(key, candidate);
  }
}

function applyProfileSelectorOverrides(overrides: Partial<Record<ProfileSelectorKey, string>>): void {
  for (const key of Object.keys(DEFAULT_PROFILE_SELECTORS) as (keyof typeof DEFAULT_PROFILE_SELECTORS)[]) {
    const candidate = overrides[key];
    if (candidate !== undefined && isValidSelector(candidate)) {
      PROFILE_SELECTORS[key] = candidate;
      continue;
    }
    PROFILE_SELECTORS[key] = DEFAULT_PROFILE_SELECTORS[key];
    if (candidate !== undefined) reportInvalidOverride(key, candidate);
  }
}

export type SelectorOverrides = {
  signal?: Partial<Record<SignalSelectorKey, string>>;
  profile?: Partial<Record<ProfileSelectorKey, string>>;
};

export function applySelectorOverrides(overrides: SelectorOverrides): void {
  applySignalSelectorOverrides(overrides.signal ?? {});
  applyProfileSelectorOverrides(overrides.profile ?? {});
}
