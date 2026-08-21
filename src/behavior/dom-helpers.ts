
import { SIGNAL_DOM_SELECTORS as SELECTORS } from '@/signal/dom/selectors';
import type { ClickTargetType, EngagementKind } from '@/shared/behavior';
import type { AttentionClickKind } from '@/shared/attention';

const ENGAGEMENT_TESTIDS = new Set(['reply', 'retweet', 'unretweet', 'like', 'unlike', 'bookmark', 'removeBookmark']);

function engagementTestIdToClickKind(testId: string | undefined): AttentionClickKind | null {
  return testId !== undefined && ENGAGEMENT_TESTIDS.has(testId) ? (testId as AttentionClickKind) : null;
}

function engagementKindFromTestId(testId: string): EngagementKind | undefined {
  if (testId === 'like' || testId === 'unlike') return 'like';
  if (testId === 'retweet' || testId === 'unretweet') return 'retweet';
  if (testId === 'reply') return 'reply';
  if (testId === 'bookmark' || testId === 'removeBookmark') return 'bookmark';
  return undefined;
}

export function classifyClick(
  target: Element,
): {
  targetType: ClickTargetType;
  engagementKind?: EngagementKind;
  engagementTestId?: string;
  href?: string;
} | null {
  const engagementEl = target.closest('[data-testid]');
  const testId = engagementEl?.getAttribute('data-testid') ?? '';
  if (ENGAGEMENT_TESTIDS.has(testId)) {

    return {
      targetType: 'engagement_button',
      engagementKind: engagementKindFromTestId(testId),
      engagementTestId: testId,
    };
  }

  if (target.closest('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]')) {
    return { targetType: 'media' };
  }

  if (target.closest('[data-testid="article-cover-image"]')) {
    return { targetType: 'open_detail' };
  }

  const cardWrapper = target.closest('[data-testid="card.wrapper"]');
  if (cardWrapper) {
    const cardLink = cardWrapper.querySelector('a[href]') as HTMLAnchorElement | null;
    return { targetType: 'link', href: cardLink?.getAttribute('href') ?? undefined };
  }

  if (target.closest(`:is(${SELECTORS.USER_NAME}) time`)) {
    return { targetType: 'open_detail' };
  }

  if (target.closest(`${SELECTORS.TWEET_AVATAR}, ${SELECTORS.USER_NAME}`)) {
    const profileLink = target.closest('a') as HTMLAnchorElement | null;
    return { targetType: 'profile', href: profileLink?.getAttribute('href') ?? undefined };
  }

  const tweetText = target.closest('[data-testid="tweetText"]') as HTMLElement | null;
  const link = target.closest('a') as HTMLAnchorElement | null;
  if (link && tweetText?.contains(link)) {
    const href = link.getAttribute('href') ?? '';
    let url: URL;
    try {
      url = new URL(href, location.origin);
    } catch {
      return { targetType: 'link', href };
    }

    const sameOrigin = url.hostname === location.hostname;
    if (sameOrigin && url.pathname.startsWith('/hashtag/')) {
      return { targetType: 'hashtag', href: url.pathname };
    }
    if (sameOrigin && url.pathname !== '/search' && /^\/[^/]+$/.test(url.pathname)) {
      return { targetType: 'mention', href: url.pathname };
    }
    return { targetType: 'link', href: sameOrigin ? url.pathname : url.href };
  }

  if (tweetText) {
    return { targetType: 'open_detail' };
  }

  return null;
}

export const ARTICLE_SELECTOR = SELECTORS.ARTICLE;

export function isPromotedArticle(article: HTMLElement): boolean {
  if (article.querySelector('[data-testid="promotedIndicator"]')) return true;
  const socialContext = article.querySelector('[data-testid="socialContext"]');
  return /\bad\b/i.test(socialContext?.textContent?.trim() ?? '');
}

const ATTENTION_XCOM_HOSTS = new Set(['x.com', 'twitter.com']);

function isOutboundHref(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, location.origin);
    return !ATTENTION_XCOM_HOSTS.has(url.hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

export function toAttentionClickKind(
  classified: { targetType: ClickTargetType; engagementTestId?: string; href?: string },
  isQuoted: boolean,
): AttentionClickKind | null {

  if (classified.targetType === 'engagement_button') {
    return engagementTestIdToClickKind(classified.engagementTestId);
  }
  if (isQuoted) return 'quoted';
  if (classified.targetType === 'open_detail') return 'detail';
  if (classified.targetType === 'media') return 'media';
  if (isOutboundHref(classified.href)) return 'outbound';
  return null;
}
