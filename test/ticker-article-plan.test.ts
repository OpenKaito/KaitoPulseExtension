import assert from "node:assert/strict";
import test from "node:test";

import { TickerArticlePlanner } from "../src/signal/token-chart/article-plan.ts";
import { parseNativeEntityHint } from "../src/signal/token-chart/native-entity-hint.ts";
import { normalizeCashtagSymbol } from "../src/signal/token-chart/symbol.ts";

const DOM = {
  tweetTextSelector: () => "tweet-text",
  cashtagLinkSelector: () => "cashtag-link",
  cashtagSweptAttr: "data-signal-cashtag-swept",
  surfaceAttr: "data-signal-surface",
  surfaceValue: "tokenChart.feed",
  normalizeSymbol: normalizeCashtagSymbol,
  parseEntityHint: parseNativeEntityHint,
  getArticleTweetId: (article: HTMLElement) =>
    (article as unknown as FakeArticle).tweetId,
  getArticleAuthorHandle: (article: HTMLElement) =>
    (article as unknown as FakeArticle).authorHandle,
  isCurrentAnchor: (article: HTMLElement, anchor: HTMLElement) =>
    anchor.isConnected && (article as unknown as FakeArticle).contains(anchor),
};

class FakeAnchor {
  readonly attributes = new Map<string, string>();
  textContent: string | null;
  isConnected = true;

  constructor(textContent: string | null, href?: string) {
    this.textContent = textContent;
    if (href !== undefined) this.attributes.set("href", href);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
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
  authorHandle: string | null;
  tweetId: string | null;

  constructor(
    tweetTexts: FakeTweetText[],
    authorHandle: string | null = "Pixelmon",
    tweetId: string | null = "1",
  ) {
    this.tweetTexts = tweetTexts;
    this.authorHandle = authorHandle;
    this.tweetId = tweetId;
  }

  querySelectorAll(): FakeTweetText[] {
    return this.tweetTexts;
  }

  contains(candidate: unknown): boolean {
    return this.tweetTexts.some((tweetText) => tweetText.anchors.includes(candidate as FakeAnchor));
  }
}

function asArticle(article: FakeArticle): HTMLElement {
  return article as unknown as HTMLElement;
}

test("does not resolve the author for cashtag-free or already-swept articles", () => {
  let lookups = 0;
  const planner = new TickerArticlePlanner(async () => {
    lookups++;
    return "781076955332354053";
  }, DOM);

  const cashtagFree = new FakeArticle([new FakeTweetText([])]);
  const sweptAnchor = new FakeAnchor("$MON");
  const alreadySwept = new FakeArticle([new FakeTweetText([sweptAnchor])]);

  assert.equal(planner.plan(asArticle(cashtagFree), "7"), null);
  assert.ok(planner.plan(asArticle(alreadySwept), "7"));
  lookups = 0;
  assert.equal(planner.plan(asArticle(alreadySwept), "7"), null);
  assert.equal(lookups, 0);
});

test("shares one author lookup across multiple anchors in an article", async () => {
  let lookups = 0;
  const planner = new TickerArticlePlanner(async () => {
    lookups++;
    return "781076955332354053";
  }, DOM);
  const article = new FakeArticle([
    new FakeTweetText([
      new FakeAnchor("$MON", "/search?q=%24MON"),
      new FakeAnchor("$BTC", "/search?q=%24BTC"),
    ]),
  ]);

  const plan = planner.plan(asArticle(article), "7");

  assert.ok(plan);
  assert.deepEqual(
    plan.anchors.map(({ symbol }) => symbol),
    ["MON", "BTC"],
  );
  assert.equal(lookups, 1);
  assert.equal(await plan.authorId, "781076955332354053");
});

test("reuses the article author lookup when a later scan finds a new anchor", () => {
  let lookups = 0;
  const planner = new TickerArticlePlanner(
    () =>
      new Promise(() => {
        lookups++;
      }),
    DOM,
  );
  const tweetText = new FakeTweetText([new FakeAnchor("$MON")]);
  const article = new FakeArticle([tweetText]);

  assert.ok(planner.plan(asArticle(article), "7"));
  tweetText.anchors.push(new FakeAnchor("$BTC"));
  assert.ok(planner.plan(asArticle(article), "7"));

  assert.equal(lookups, 1);
});

test("retries a completed miss when a later scan finds a new anchor", async () => {
  let lookups = 0;
  const planner = new TickerArticlePlanner(async () => {
    lookups++;
    return null;
  }, DOM);
  const tweetText = new FakeTweetText([new FakeAnchor("$MON")]);
  const article = new FakeArticle([tweetText]);

  const firstPlan = planner.plan(asArticle(article), "7");
  assert.ok(firstPlan);
  await firstPlan.authorId;

  tweetText.anchors.push(new FakeAnchor("$BTC"));
  assert.ok(planner.plan(asArticle(article), "7"));

  assert.equal(lookups, 2);
});

test("invalidates a pending plan and replans when the same anchor is reused", async () => {
  let resolveOldLookup: ((value: string | null) => void) | undefined;
  const planner = new TickerArticlePlanner(
    (handle) => {
      if (handle !== "Pixelmon") return Promise.resolve("monad-author-id");
      return new Promise((resolve) => {
        resolveOldLookup = resolve;
      });
    },
    DOM,
  );
  const anchor = new FakeAnchor("$MON", "/search?q=%24MON");
  const article = new FakeArticle([new FakeTweetText([anchor])], "Pixelmon", "1");

  const oldPlan = planner.plan(asArticle(article), "7");
  assert.ok(oldPlan);

  article.authorHandle = "monad_xyz";
  article.tweetId = "2";
  anchor.setAttribute("href", "/search?q=%24MON%20OR%20monad%3Anative");
  const currentPlan = planner.plan(asArticle(article), "7");

  assert.ok(currentPlan);
  assert.equal(oldPlan.isCurrent(oldPlan.anchors[0]), false);
  assert.equal(currentPlan.isCurrent(currentPlan.anchors[0]), true);

  resolveOldLookup?.("pixelmon-author-id");
  await oldPlan.authorId;
  assert.equal(oldPlan.isCurrent(oldPlan.anchors[0]), false);
});

test("starts a fresh lookup when a recycled article changes author", () => {
  const handles: string[] = [];
  const planner = new TickerArticlePlanner(async (handle) => {
    handles.push(handle);
    return handle;
  }, DOM);
  const tweetText = new FakeTweetText([new FakeAnchor("$MON")]);
  const article = new FakeArticle([tweetText]);

  assert.ok(planner.plan(asArticle(article), "7"));
  article.authorHandle = "monad_xyz";
  tweetText.anchors.push(new FakeAnchor("$MONAD"));
  assert.ok(planner.plan(asArticle(article), "7"));

  assert.deepEqual(handles, ["Pixelmon", "monad_xyz"]);
});
