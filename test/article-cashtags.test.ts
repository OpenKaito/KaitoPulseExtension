import assert from "node:assert/strict";
import test from "node:test";

import {
  extractArticleCashtags,
  type CashtagExtractorDom,
} from "../src/behavior/article-cashtags.ts";
import { normalizeCashtagSymbol } from "../src/signal/token-chart/symbol.ts";
import { parseNativeEntityHint } from "../src/signal/token-chart/native-entity-hint.ts";

const DOM: CashtagExtractorDom = {
  tweetTextSelector: () => "tweet-text",
  cashtagLinkSelector: () => "cashtag-link",
  normalizeSymbol: normalizeCashtagSymbol,
  parseEntityHint: parseNativeEntityHint,
};

class FakeAnchor {
  readonly attributes = new Map<string, string>();
  textContent: string | null;

  constructor(textContent: string | null, href?: string) {
    this.textContent = textContent;
    if (href !== undefined) this.attributes.set("href", href);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeTweetText {
  readonly anchors: FakeAnchor[];
  constructor(anchors: FakeAnchor[]) {
    this.anchors = anchors;
  }
  querySelectorAll(): FakeAnchor[] {
    return this.anchors;
  }
}

class FakeArticle {
  readonly tweetTexts: FakeTweetText[];
  constructor(tweetTexts: FakeTweetText[]) {
    this.tweetTexts = tweetTexts;
  }
  querySelectorAll(): FakeTweetText[] {
    return this.tweetTexts;
  }
}

function asRoot(article: FakeArticle): HTMLElement {
  return article as unknown as HTMLElement;
}

test("extracts normalized symbols with entity hints across tweet-text blocks", () => {
  const article = new FakeArticle([
    new FakeTweetText([
      new FakeAnchor("$MON", "/search?q=%24MON%20OR%20monad%3Anative"),
      new FakeAnchor("$btc", "/search?q=%24BTC"),
    ]),
  ]);

  assert.deepEqual(extractArticleCashtags(asRoot(article), DOM), [
    { symbol: "MON", entityHint: "monad:native" },
    { symbol: "BTC" },
  ]);
});

test("skips anchors whose text is not a valid cashtag", () => {
  const article = new FakeArticle([
    new FakeTweetText([
      new FakeAnchor("not a ticker"),
      new FakeAnchor("$GOODONE"),
    ]),
  ]);

  assert.deepEqual(extractArticleCashtags(asRoot(article), DOM), [
    { symbol: "GOODONE" },
  ]);
});

test("dedupes repeated symbol+hint occurrences", () => {
  const article = new FakeArticle([
    new FakeTweetText([
      new FakeAnchor("$MON", "/search?q=%24MON"),
      new FakeAnchor("$MON", "/search?q=%24MON"),
      new FakeAnchor("$MON", "/search?q=%24MON%20OR%20monad%3Anative"),
    ]),
  ]);

  assert.deepEqual(extractArticleCashtags(asRoot(article), DOM), [
    { symbol: "MON" },
    { symbol: "MON", entityHint: "monad:native" },
  ]);
});

test("returns an empty list when there are no cashtags", () => {
  const article = new FakeArticle([new FakeTweetText([])]);
  assert.deepEqual(extractArticleCashtags(asRoot(article), DOM), []);
});

test("caps the number of cashtags per event at 10", () => {
  const anchors = Array.from(
    { length: 15 },
    (_, i) => new FakeAnchor(`$SYM${i}`),
  );
  const article = new FakeArticle([new FakeTweetText(anchors)]);

  assert.equal(extractArticleCashtags(asRoot(article), DOM).length, 10);
});
