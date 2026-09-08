export interface TickerArticleAnchor {
  anchor: HTMLElement;
  symbol: string;
  entityHint?: string;
  fingerprint: string;
}

export interface TickerArticlePlan {
  anchors: TickerArticleAnchor[];
  authorId: Promise<string | null>;
  authorHandle: string | null;
  tweetId: string | null;
  isCurrent: (anchor: TickerArticleAnchor) => boolean;
}

type ResolveAuthorId = (handle: string) => Promise<string | null>;
type ReportAuthorLookupError = (handle: string, error: unknown) => void;

export interface TickerArticleDomConfig {
  tweetTextSelector: () => string;
  cashtagLinkSelector: () => string;
  cashtagSweptAttr: string;
  surfaceAttr: string;
  surfaceValue: string;
  normalizeSymbol: (text: string | null | undefined) => string | null;
  parseEntityHint: (href: string | null | undefined) => string | undefined;
  getArticleTweetId: (article: HTMLElement) => string | null;
  getArticleAuthorHandle: (article: HTMLElement) => string | null;
  isCurrentAnchor: (article: HTMLElement, anchor: HTMLElement) => boolean;
}

interface CachedAuthorId {
  handle: string;
  value: Promise<string | null>;
}

interface ArticleOccurrenceContext {
  authorHandle: string | null;
  normalizedAuthorHandle: string | null;
  tweetId: string | null;
}

export class TickerArticlePlanner {
  private readonly authorIds = new WeakMap<HTMLElement, CachedAuthorId>();
  private readonly resolveAuthorId: ResolveAuthorId;
  private readonly dom: TickerArticleDomConfig;
  private readonly reportAuthorLookupError: ReportAuthorLookupError | undefined;

  constructor(
    resolveAuthorId: ResolveAuthorId,
    dom: TickerArticleDomConfig,
    reportAuthorLookupError?: ReportAuthorLookupError,
  ) {
    this.resolveAuthorId = resolveAuthorId;
    this.dom = dom;
    this.reportAuthorLookupError = reportAuthorLookupError;
  }

  plan(article: HTMLElement, generation: string): TickerArticlePlan | null {
    const context = this.readContext(article);
    const anchors = this.collectAnchors(article, generation, context);
    if (anchors.length === 0) return null;

    return {
      anchors,
      authorId: this.getAuthorId(article, context.authorHandle),
      authorHandle: context.authorHandle,
      tweetId: context.tweetId,
      isCurrent: (anchor) => this.isCurrent(article, anchor, generation),
    };
  }

  private collectAnchors(
    article: HTMLElement,
    generation: string,
    context: ArticleOccurrenceContext,
  ): TickerArticleAnchor[] {
    const anchors: TickerArticleAnchor[] = [];

    for (const tweetText of article.querySelectorAll(this.dom.tweetTextSelector())) {
      for (const anchor of tweetText.querySelectorAll(this.dom.cashtagLinkSelector())) {
        const anchorEl = anchor as HTMLElement;
        const symbol = this.dom.normalizeSymbol(anchorEl.textContent);
        const entityHint = this.dom.parseEntityHint(anchorEl.getAttribute('href'));
        const fingerprint = this.fingerprint(generation, context, symbol, entityHint);
        if (anchorEl.getAttribute(this.dom.cashtagSweptAttr) === fingerprint) continue;

        anchorEl.setAttribute(this.dom.cashtagSweptAttr, fingerprint);
        if (!symbol) continue;

        anchorEl.setAttribute(this.dom.surfaceAttr, this.dom.surfaceValue);
        anchors.push({
          anchor: anchorEl,
          symbol,
          ...(entityHint ? { entityHint } : {}),
          fingerprint,
        });
      }
    }

    return anchors;
  }

  private isCurrent(
    article: HTMLElement,
    anchor: TickerArticleAnchor,
    generation: string,
  ): boolean {
    if (!this.dom.isCurrentAnchor(article, anchor.anchor)) return false;
    if (anchor.anchor.getAttribute(this.dom.cashtagSweptAttr) !== anchor.fingerprint) return false;

    const context = this.readContext(article);
    const symbol = this.dom.normalizeSymbol(anchor.anchor.textContent);
    const entityHint = this.dom.parseEntityHint(anchor.anchor.getAttribute('href'));
    return this.fingerprint(generation, context, symbol, entityHint) === anchor.fingerprint;
  }

  private readContext(article: HTMLElement): ArticleOccurrenceContext {
    const authorHandle = this.dom.getArticleAuthorHandle(article);
    return {
      authorHandle,
      normalizedAuthorHandle: authorHandle ? authorHandle.replace(/^@/, '').toLowerCase() : null,
      tweetId: this.dom.getArticleTweetId(article),
    };
  }

  private fingerprint(
    generation: string,
    context: ArticleOccurrenceContext,
    symbol: string | null,
    entityHint: string | undefined,
  ): string {
    return JSON.stringify([
      generation,
      context.tweetId,
      context.normalizedAuthorHandle,
      symbol,
      entityHint ?? null,
    ]);
  }

  private getAuthorId(article: HTMLElement, authorHandle: string | null): Promise<string | null> {
    if (!authorHandle) return Promise.resolve(null);

    const normalizedHandle = authorHandle.replace(/^@/, '').toLowerCase();
    const cached = this.authorIds.get(article);
    if (cached?.handle === normalizedHandle) return cached.value;

    const value = this.resolveAuthorId(authorHandle).catch((error) => {
      this.reportAuthorLookupError?.(authorHandle, error);
      return null;
    });
    this.authorIds.set(article, { handle: normalizedHandle, value });
    void value.then((authorId) => {
      if (authorId !== null) return;
      if (this.authorIds.get(article)?.value === value) this.authorIds.delete(article);
    });
    return value;
  }
}
