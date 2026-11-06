import assert from 'node:assert/strict';
import test from 'node:test';

import {
  holdScreenWakeLockInPage,
  releaseScreenWakeLockInPage,
} from '../src/background/proof-wake-lock.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function installPage(options: { wakeLock?: boolean; deny?: boolean } = {}) {
  const listeners = new Set<() => void>();
  const sentinels: { released: boolean; release(): Promise<void> }[] = [];
  const doc = {
    visibilityState: 'visible',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const navigator =
    options.wakeLock === false
      ? {}
      : {
          wakeLock: {
            request: async () => {
              if (options.deny) throw new Error('NotAllowedError');
              const sentinel = {
                released: false,
                release: async () => {
                  sentinel.released = true;
                },
              };
              sentinels.push(sentinel);
              return sentinel;
            },
          },
        };
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
  const setVisibility = (state: 'visible' | 'hidden') => {
    doc.visibilityState = state;
    if (state === 'hidden') for (const s of sentinels) s.released = true;
    for (const fn of listeners) fn();
  };
  return { sentinels, listeners, setVisibility };
}

test('holds the screen awake until released', async () => {
  const { sentinels, listeners } = installPage();
  holdScreenWakeLockInPage();
  await tick();
  assert.equal(sentinels.length, 1);
  assert.equal(sentinels[0].released, false);
  releaseScreenWakeLockInPage();
  assert.equal(sentinels[0].released, true);
  assert.equal(listeners.size, 0);
});

test('a second hold in the same page does not stack', async () => {
  const { sentinels, listeners } = installPage();
  holdScreenWakeLockInPage();
  holdScreenWakeLockInPage();
  await tick();
  assert.equal(sentinels.length, 1);
  assert.equal(listeners.size, 1);
  releaseScreenWakeLockInPage();
});

test('re-acquires after the page comes back to the foreground', async () => {
  const { sentinels, setVisibility } = installPage();
  holdScreenWakeLockInPage();
  await tick();
  setVisibility('hidden');
  await tick();
  assert.equal(sentinels.length, 1);
  setVisibility('visible');
  await tick();
  assert.equal(sentinels.length, 2);
  releaseScreenWakeLockInPage();
  assert.equal(sentinels[1].released, true);
});

test('a lock granted after release is dropped at once', async () => {
  const { sentinels } = installPage();
  holdScreenWakeLockInPage();
  releaseScreenWakeLockInPage();
  await tick();
  assert.equal(sentinels.length, 1);
  assert.equal(sentinels[0].released, true);
});

test('no Wake Lock API, a denied request, or a release with nothing held is a no-op', async () => {
  const missing = installPage({ wakeLock: false });
  holdScreenWakeLockInPage();
  assert.equal(missing.listeners.size, 0);
  releaseScreenWakeLockInPage();

  const denied = installPage({ deny: true });
  holdScreenWakeLockInPage();
  await tick();
  assert.equal(denied.sentinels.length, 0);
  releaseScreenWakeLockInPage();
  releaseScreenWakeLockInPage();
});
