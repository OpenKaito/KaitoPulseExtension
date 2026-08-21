
import { SIGNAL_DOM_SELECTORS as SELECTORS } from '@/signal/dom/selectors';
import { ARTICLE_SELECTOR, isPromotedArticle } from './dom-helpers';
import { getArticleTweetId } from '@/signal/dom/adapter';
import type { BehaviorActor, BehaviorEvent } from '@/shared/behavior';
import { createBehaviorEventId } from '@/shared/behavior';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { createAttentionEventId, sanitizePageUrl } from '@/shared/attention';

const CONFIRM_WATCH_MS = 1500;
const FOLLOW_TESTID_RE = /^(\d+)-(follow|unfollow)$/;

export class FollowTracker {
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
    const control = target?.closest(SELECTORS.FOLLOW_CONTROL) as HTMLElement | null;
    if (!control) return;

    const before = (control.getAttribute('data-testid') ?? '').match(FOLLOW_TESTID_RE);
    if (!before) return;
    const [, targetTwitterId, beforeState] = before;
    const targetHandle = control.getAttribute('aria-label')?.match(/@(\w+)/)?.[1] ?? null;
    const startedAt = performance.now();

    const checkForFlip = (): void => {
      if (!control.isConnected) return;
      const after = (control.getAttribute('data-testid') ?? '').match(FOLLOW_TESTID_RE);
      if (after && after[2] !== beforeState) {

        const kind = after[2] === 'unfollow' ? 'follow' : 'unfollow';
        this.emit({
          id: createBehaviorEventId(),
          ts: Date.now(),
          kind,
          actor: this.getActor(),
          surface: 'feed',
          payload: { targetTwitterId, targetHandle },
        });
        this.emitAttentionFollow(kind, control, targetTwitterId, targetHandle);
        return;
      }
      if (performance.now() - startedAt < CONFIRM_WATCH_MS) {
        requestAnimationFrame(checkForFlip);
      }

    };
    requestAnimationFrame(checkForFlip);
  }

  private emitAttentionFollow(
    kind: 'follow' | 'unfollow',
    control: HTMLElement,
    targetTwitterId: string,
    targetHandle: string | null,
  ): void {
    const article = control.closest(ARTICLE_SELECTOR) as HTMLElement | null;
    const rect = (article ?? control).getBoundingClientRect();

    const firedAt = Date.now();
    this.emitAttention({
      eventId: createAttentionEventId(),
      type: kind,
      tweetId: article ? (getArticleTweetId(article) ?? '') : '',
      authorHandle: targetHandle,

      authorTwitterId: null,
      targetTwitterId,
      isPromoted: article ? isPromotedArticle(article) : false,
      truncated: false,
      tsStart: firedAt,
      tsEnd: firedAt,
      dwellMs: 0,
      clickKind: null,
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
