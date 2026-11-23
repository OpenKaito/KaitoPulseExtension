import type { AttentionCashtag } from '@/shared/attention';

export interface CashtagExtractorDom {
  tweetTextSelector: () => string;
  cashtagLinkSelector: () => string;
  normalizeSymbol: (text: string | null | undefined) => string | null;
  parseEntityHint: (href: string | null | undefined) => string | undefined;
}

const MAX_CASHTAGS_PER_EVENT = 10;

export function extractArticleCashtags(
  root: HTMLElement,
  dom: CashtagExtractorDom,
): AttentionCashtag[] {
  const out: AttentionCashtag[] = [];
  const seen = new Set<string>();

  for (const tweetText of root.querySelectorAll(dom.tweetTextSelector())) {
    for (const anchor of tweetText.querySelectorAll(dom.cashtagLinkSelector())) {
      const symbol = dom.normalizeSymbol(anchor.textContent);
      if (!symbol) continue;

      const entityHint = dom.parseEntityHint(anchor.getAttribute('href'));
      const key = entityHint ? `${symbol}\u0000${entityHint}` : symbol;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push(entityHint ? { symbol, entityHint } : { symbol });
      if (out.length >= MAX_CASHTAGS_PER_EVENT) return out;
    }
  }

  return out;
}
