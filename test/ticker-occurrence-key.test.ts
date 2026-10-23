import assert from "node:assert/strict";
import test from "node:test";

import {
  conflictingOccurrenceResponseKeys,
  fromOccurrenceCacheKey,
  toOccurrenceCacheKey,
  toOccurrenceResponseKey,
} from "../src/signal/token-chart/occurrence-key.ts";


const base = { cashtag: "MON", tweetId: "1" };

test("cache identity changes when any entity evidence changes", () => {
  const keys = new Set([
    toOccurrenceCacheKey(base),
    toOccurrenceCacheKey({ ...base, entityHint: "monad:native" }),
    toOccurrenceCacheKey({ ...base, authorHandle: "Pixelmon" }),
    toOccurrenceCacheKey({ ...base, authorId: "1000000000000000001" }),
  ]);

  assert.equal(keys.size, 4);
});

test("cache identity round-trips all optional evidence fields", () => {
  const occurrence = {
    cashtag: "MON",
    tweetId: "1",
    authorId: "2",
    entityHint: "monad:native",
    authorHandle: "Route2FI",
  };

  assert.deepEqual(fromOccurrenceCacheKey(toOccurrenceCacheKey(occurrence)), occurrence);
});

test("response identity stays scoped to the fields echoed by BFF", () => {
  assert.equal(toOccurrenceResponseKey("MON", "1"), toOccurrenceResponseKey("MON", "1"));
  assert.notEqual(toOccurrenceResponseKey("MON", "1"), toOccurrenceResponseKey("MON", "2"));
});

test("detects different evidence that BFF cannot distinguish in its response key", () => {
  const conflicts = conflictingOccurrenceResponseKeys([
    { ...base, entityHint: "monad:native" },
    { ...base, authorHandle: "Pixelmon" },
    { cashtag: "MON", tweetId: "2", authorHandle: "Pixelmon" },
  ]);

  assert.deepEqual([...conflicts], [toOccurrenceResponseKey("MON", "1")]);
});

test("does not flag exact duplicate evidence", () => {
  const occurrence = { ...base, entityHint: "monad:native" };
  assert.equal(conflictingOccurrenceResponseKeys([occurrence, occurrence]).size, 0);
});
