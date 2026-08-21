
import { getArticleAuthorHandle, getArticleTweetId } from '@/signal/dom/adapter';
import { twitterIdMap } from '@/signal/twitter-id-map';
import { isPromotedArticle } from './dom-helpers';
import type { BehaviorActor, BehaviorEvent } from '@/shared/behavior';
import { createBehaviorEventId } from '@/shared/behavior';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { createAttentionEventId, sanitizePageUrl } from '@/shared/attention';

const MIN_DWELL_MS = 300;
const VISIBLE_THRESHOLD = 0.5;

const TALL_CARD_MIN_HEIGHT = 200;
const PRUNE_INTERVAL_MS = 10_000;

interface TrackedArticle {

  visibleSinceMs: number | null;
  accumulatedMs: number;
}

function isSubstantiallyVisible(article: HTMLElement): boolean {
  const rect = article.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const visibleHeight = Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0);
  const visibleWidth = Math.min(rect.right, viewportW) - Math.max(rect.left, 0);
  if (visibleHeight <= 0 || visibleWidth <= 0) return false;
  const totalArea = rect.height * rect.width;
  if (totalArea > 0 && (visibleHeight * visibleWidth) / totalArea >= VISIBLE_THRESHOLD) return true;
  return visibleHeight >= TALL_CARD_MIN_HEIGHT;
}

export class ImpressionTracker {

  private readonly tracked = new Map<HTMLElement, TrackedArticle>();
  private readonly observer: IntersectionObserver;
  private readonly pruneTimer: ReturnType<typeof setInterval>;
  private idle = false;

  constructor(
    private readonly getActor: () => BehaviorActor,
    private readonly emit: (event: BehaviorEvent) => void,
    private readonly emitAttention: (event: AttentionBehaviorEvent) => void = () => {},
  ) {
    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => this.onIntersect(entry)),
      { threshold: [0, VISIBLE_THRESHOLD] },
    );
    this.pruneTimer = setInterval(() => this.pruneDetached(), PRUNE_INTERVAL_MS);
  }

  watch(article: HTMLElement): void {
    if (this.tracked.has(article)) return;
    this.tracked.set(article, { visibleSinceMs: null, accumulatedMs: 0 });
    this.observer.observe(article);
  }

  private onIntersect(entry: IntersectionObserverEntry): void {
    if (this.idle) return;
    const article = entry.target as HTMLElement;
    const state = this.tracked.get(article);
    if (!state) return;
    const now = performance.now();
    const visibleNow =
      entry.intersectionRatio >= VISIBLE_THRESHOLD || entry.intersectionRect.height >= TALL_CARD_MIN_HEIGHT;

    if (visibleNow && state.visibleSinceMs === null) {
      state.visibleSinceMs = now;
    } else if (!visibleNow && state.visibleSinceMs !== null) {
      state.accumulatedMs += now - state.visibleSinceMs;
      state.visibleSinceMs = null;
      this.maybeEmitAndReset(article, state);
    }
  }

  setIdle(idle: boolean): void {
    if (idle === this.idle) return;
    this.idle = idle;
    if (idle) {
      const now = performance.now();
      for (const [, state] of this.tracked) {
        if (state.visibleSinceMs === null) continue;
        state.accumulatedMs += now - state.visibleSinceMs;
        state.visibleSinceMs = null;
      }
    } else {
      this.rearmVisibleSpans();
    }
  }

  rearmVisibleSpans(): void {
    if (this.idle) return;
    const now = performance.now();
    for (const [article, state] of this.tracked) {
      if (state.visibleSinceMs !== null) continue;
      if (isSubstantiallyVisible(article)) state.visibleSinceMs = now;
    }
  }

  private pruneDetached(): void {
    for (const [article, state] of this.tracked) {
      if (article.isConnected) continue;
      this.closeOpenSpan(article, state);
      this.observer.unobserve(article);
      this.tracked.delete(article);
    }
  }

  flushAllOpenSpans(): void {
    for (const [article, state] of this.tracked) {
      this.closeOpenSpan(article, state);
    }
  }

  snapshotOpenSpans(): { tweetId: string; tsStart: number }[] {
    const now = performance.now();
    const out: { tweetId: string; tsStart: number }[] = [];
    for (const [article, state] of this.tracked) {
      if (state.visibleSinceMs === null) continue;
      const tweetId = getArticleTweetId(article);
      if (!tweetId) continue;
      const openMs = now - state.visibleSinceMs + state.accumulatedMs;
      out.push({ tweetId, tsStart: Date.now() - openMs });
    }
    return out;
  }

  private closeOpenSpan(article: HTMLElement, state: TrackedArticle): void {
    if (state.visibleSinceMs !== null) {
      state.accumulatedMs += performance.now() - state.visibleSinceMs;
      state.visibleSinceMs = null;
    }
    this.maybeEmitAndReset(article, state);
  }

  private maybeEmitAndReset(article: HTMLElement, state: TrackedArticle): void {
    const dwellMs = state.accumulatedMs;
    state.accumulatedMs = 0;
    if (dwellMs < MIN_DWELL_MS) return;
    const tweetId = getArticleTweetId(article);
    if (!tweetId) return;
    const authorHandle = getArticleAuthorHandle(article);
    this.emit({
      id: createBehaviorEventId(),
      ts: Date.now(),
      kind: 'impression',
      actor: this.getActor(),
      surface: 'feed',
      payload: { tweetId, authorHandle, dwellMs: Math.round(dwellMs) },
    });

    const tsEnd = Date.now();
    const rect = article.getBoundingClientRect();
    this.emitAttention({
      eventId: createAttentionEventId(),
      type: 'impression',
      tweetId,
      authorHandle,
      authorTwitterId: authorHandle ? twitterIdMap.resolve(authorHandle) : null,
      targetTwitterId: null,
      isPromoted: isPromotedArticle(article),
      truncated: false,
      tsStart: tsEnd - Math.round(dwellMs),
      tsEnd,
      dwellMs: Math.round(dwellMs),
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

  dispose(): void {
    clearInterval(this.pruneTimer);
    this.observer.disconnect();
    this.tracked.clear();
  }
}
