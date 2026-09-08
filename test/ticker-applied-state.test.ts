import assert from "node:assert/strict";
import test from "node:test";

import { invalidateTickerAnchor } from "../src/signal/token-chart/applied-state.ts";

const CHIP_ATTR = "data-signal-cashtag-chip";

class FakeAnchor {
  readonly attributes = new Map<string, string>();

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

interface FakeEntry {
  entity: string;
  symbol: string;
  results: Map<string, string>;
}

class FakePopover {
  readonly entries = new Map<FakeAnchor, FakeEntry>();

  register(anchor: FakeAnchor, symbol: string, entity: string): FakeEntry {
    const existing = this.entries.get(anchor);
    const entry = {
      entity,
      symbol,
      results: existing?.symbol === symbol ? existing.results : new Map<string, string>(),
    };
    this.entries.set(anchor, entry);
    return entry;
  }

  unregister(anchor: FakeAnchor): void {
    this.entries.delete(anchor);
  }
}

function invalidate(anchor: FakeAnchor, popover: FakePopover): void {
  invalidateTickerAnchor(
    anchor as unknown as HTMLElement,
    CHIP_ATTR,
    (target) => popover.unregister(target as unknown as FakeAnchor),
  );
}

test("clears an applied chart when the replanned occurrence abstains", () => {
  const anchor = new FakeAnchor();
  const popover = new FakePopover();
  popover.register(anchor, "MON", "pixelmon");
  anchor.setAttribute(CHIP_ATTR, "dark");

  invalidate(anchor, popover);
  const newResolution = null;
  if (newResolution) popover.register(anchor, "MON", newResolution);

  assert.equal(anchor.getAttribute(CHIP_ATTR), null);
  assert.equal(popover.entries.has(anchor), false);
});

test("drops the old period cache before the same symbol resolves to a new entity", () => {
  const anchor = new FakeAnchor();
  const popover = new FakePopover();
  const oldEntry = popover.register(anchor, "MON", "pixelmon");
  oldEntry.results.set("12M", "pixelmon-chart");

  invalidate(anchor, popover);
  const newEntry = popover.register(anchor, "MON", "monad");

  assert.notEqual(newEntry.results, oldEntry.results);
  assert.equal(newEntry.results.size, 0);
  assert.equal(newEntry.entity, "monad");
});
