import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith('./') && !specifier.endsWith('.ts')) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { X_CREATOR_REWARDS_PAGE_URL, readCookieValue, readXCreatorRewardsPage } = await import(
  '../src/signal/x-creator-rewards.ts'
);

const PAGE = new Uint8Array([0x62, 0x08, 0x00, 0xff, 0x01]);

function recordingFetch(response: () => Response) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return response();
  }) as unknown as typeof fetch;
  return { requests, fetchImpl };
}

test('reads the page as the logged-in user, in English, and returns the raw bytes', async () => {
  const { requests, fetchImpl } = recordingFetch(
    () => new Response(PAGE, { status: 200, headers: { 'x-jf-tag': 'AgE' } }),
  );
  const result = await readXCreatorRewardsPage('1234567890', 'csrf-token', fetchImpl);

  assert.deepEqual(result, {
    ok: true,
    page: { twitterId: '1234567890', jfTag: 'AgE', body: Buffer.from(PAGE).toString('base64') },
  });
  assert.equal(requests[0].url, X_CREATOR_REWARDS_PAGE_URL);
  assert.equal(requests[0].init.credentials, 'include');
  const headers = requests[0].init.headers as Record<string, string>;
  assert.equal(headers['x-csrf-token'], 'csrf-token');
  assert.equal(headers['x-twitter-client-language'], 'en');
  assert.match(headers.authorization, /^Bearer /);
});

test('reports the X status when the page is refused', async () => {
  const { fetchImpl } = recordingFetch(() => new Response('nope', { status: 403 }));
  assert.deepEqual(await readXCreatorRewardsPage('1', 'c', fetchImpl), {
    ok: false,
    error: 'unavailable',
    status: 403,
  });
});

test('a network error is unavailable, not thrown', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  assert.deepEqual(await readXCreatorRewardsPage('1', 'c', fetchImpl), { ok: false, error: 'unavailable' });
});

test('refuses an empty or oversized body', async () => {
  for (const body of [new Uint8Array(0), new Uint8Array(64 * 1024 + 1)]) {
    const { fetchImpl } = recordingFetch(() => new Response(body, { status: 200 }));
    const result = await readXCreatorRewardsPage('1', 'c', fetchImpl);
    assert.equal(result.ok, false);
  }
});

test('does not call X without the X id or the csrf cookie', async () => {
  for (const [id, csrf] of [
    [null, 'c'],
    ['1', undefined],
  ] as const) {
    const { requests, fetchImpl } = recordingFetch(() => new Response(PAGE));
    assert.deepEqual(await readXCreatorRewardsPage(id, csrf, fetchImpl), { ok: false, error: 'no_identity' });
    assert.equal(requests.length, 0);
  }
});

test('readCookieValue finds one cookie by exact name', () => {
  const cookie = 'guest_id=v1; ct0=abc123; xct0=nope';
  assert.equal(readCookieValue(cookie, 'ct0'), 'abc123');
  assert.equal(readCookieValue(cookie, 'twid'), undefined);
});
