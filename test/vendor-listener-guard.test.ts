import assert from 'node:assert/strict';
import test from 'node:test';
import { guardVendorMessageListeners } from '../src/background/vendor-listener-guard.ts';

type Listener = (message: unknown, sender: unknown, sendResponse: (r?: unknown) => void) => unknown;

function fakeEvent() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addListener: (l: Listener) => void listeners.add(l),
    removeListener: (l: Listener) => void listeners.delete(l),
    hasListener: (l: Listener) => listeners.has(l),
    dispatch(message: unknown) {
      return [...listeners].map((l) => l(message, {}, () => undefined));
    },
  };
}

const isOwn = (m: unknown) => (m as { target?: string })?.target === 'kaitoExtension';

test('an async vendor listener does not answer the extension\'s own messages', async () => {
  const event = fakeEvent();
  guardVendorMessageListeners(event as never, isOwn);
  let seen = 0;
  event.addListener(async () => {
    seen += 1;
  });

  const own = event.dispatch({ target: 'kaitoExtension', action: 'openVerifyWindow' });
  assert.deepEqual(own, [false]);
  assert.equal(seen, 0);

  const vendor = event.dispatch({ type: 'pageDecode', name: 'start' });
  assert.ok(vendor[0] instanceof Promise);
  await vendor[0];
  assert.equal(seen, 1);
});

test('remove and has resolve the wrapped listener', () => {
  const event = fakeEvent();
  guardVendorMessageListeners(event as never, isOwn);
  const listener: Listener = () => true;
  event.addListener(listener);
  assert.equal(event.hasListener(listener), true);
  assert.equal(event.listeners.size, 1);
  event.removeListener(listener);
  assert.equal(event.hasListener(listener), false);
  assert.equal(event.listeners.size, 0);
});
