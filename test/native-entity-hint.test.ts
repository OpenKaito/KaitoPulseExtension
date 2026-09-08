import assert from "node:assert/strict";
import test from "node:test";

import { parseNativeEntityHint } from "../src/signal/token-chart/native-entity-hint.ts";


test("extracts the native entity token from an encoded X search URL", () => {
  assert.equal(
    parseNativeEntityHint("/search?q=%24MON%20OR%20monad%3Anative&src=typed_query"),
    "monad:native",
  );
});

test("matches the native suffix case-insensitively while preserving the token", () => {
  assert.equal(
    parseNativeEntityHint("https://x.com/search?q=%24MON+OR+Monad%3ANATIVE"),
    "Monad:NATIVE",
  );
});

test("does not infer identity from ordinary search text or other URL fields", () => {
  assert.equal(parseNativeEntityHint("/search?q=%24MON%20OR%20Monad"), undefined);
  assert.equal(parseNativeEntityHint("/search?q=%24MON&src=monad%3Anative"), undefined);
  assert.equal(parseNativeEntityHint("/monad:native/status/1"), undefined);
});

test("fails closed when the query contains more than one native entity token", () => {
  assert.equal(
    parseNativeEntityHint("/search?q=%24MON%20OR%20monad%3Anative%20OR%20pixelmon%3Anative"),
    undefined,
  );
});

test("rejects malformed URLs, unsafe token characters, and oversized tokens", () => {
  assert.equal(parseNativeEntityHint("http://[invalid"), undefined);
  assert.equal(parseNativeEntityHint("/search?q=%24MON%20OR%20monad%2Fnative"), undefined);
  assert.equal(parseNativeEntityHint(`/search?q=${"x".repeat(65)}%3Anative`), undefined);
});

test("accepts safe project separators at token boundaries", () => {
  assert.equal(parseNativeEntityHint("/search?q=%24ABC%20OR%20foo-bar.xyz%3Anative"), "foo-bar.xyz:native");
});
