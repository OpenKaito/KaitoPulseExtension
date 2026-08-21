
import { SIGNAL_DOM_SELECTORS as SELECTORS } from '@/signal/dom/selectors';
import { ARTICLE_SELECTOR, classifyClick, isPromotedArticle, toAttentionClickKind } from './dom-helpers';
import { getArticleAuthorHandle, getArticleTweetId } from '@/signal/dom/adapter';
import { twitterIdMap } from '@/signal/twitter-id-map';
import type { BehaviorActor, BehaviorEvent } from '@/shared/behavior';
import { createBehaviorEventId } from '@/shared/behavior';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { createAttentionEventId, sanitizePageUrl } from '@/shared/attention';

export class ClickTracker {
  private readonly listener: (event: MouseEvent) => void;
  private started = false;

  constructor(
    private readonly doc: Document,
    private readonly getActor: () => BehaviorActor,
    private readonly emit: (event: BehaviorEvent) => void,
    private readonly emitAttention: (event: AttentionBehaviorEvent) => void = () => {},
  ) {
    this.listener = (event) => this.onClick(event);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.doc.addEventListener('click', this.listener, true);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.doc.removeEventListener('click', this.listener, true);
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest(SELECTORS.FOLLOW_CONTROL)) return;

    const article = target.closest(ARTICLE_SELECTOR) as HTMLElement | null;
    if (!article) return;

    const classified = classifyClick(target);
    if (!classified) return;

    this.emit({
      id: createBehaviorEventId(),
      ts: Date.now(),
      kind: 'click',
      actor: this.getActor(),
      surface: 'feed',
      payload: {
        tweetId: getArticleTweetId(article),
        targetType: classified.targetType,
        engagementKind: classified.engagementKind,
        href: classified.href,
      },
    });

    const quotedCard = target.closest(SELECTORS.QUOTED_TWEET) as HTMLElement | null;
    const isQuoted = Boolean(quotedCard && quotedCard.querySelector(SELECTORS.AVATAR));
    const attentionRoot = isQuoted ? quotedCard! : article;
    const tweetId = getArticleTweetId(attentionRoot);
    if (!tweetId) return;

    const rect = article.getBoundingClientRect();

    const clickedAt = Date.now();
    const authorHandle = getArticleAuthorHandle(attentionRoot);
    this.emitAttention({
      eventId: createAttentionEventId(),
      type: 'click',
      tweetId,
      authorHandle,
      authorTwitterId: authorHandle ? twitterIdMap.resolve(authorHandle) : null,
      targetTwitterId: null,
      isPromoted: isPromotedArticle(article),
      truncated: false,
      tsStart: clickedAt,
      tsEnd: clickedAt,
      dwellMs: 0,
      clickKind: toAttentionClickKind(classified, isQuoted),
      geo: {
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        scrollY: window.scrollY,
        tweetTop: Math.round(rect.top),
        tweetHeight: Math.round(rect.height),
      },
      pageUrl: sanitizePageUrl(location.href),

      tabId: null,
    });
  }
}
