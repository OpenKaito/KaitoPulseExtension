import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUninstallUrlSync,
  type StoredUninstallToken,
  uninstallUrl,
} from '../src/background/uninstall-url.ts';

function setup(initial?: StoredUninstallToken) {
  let stored = initial;
  const urls: string[] = [];
  let issued = 0;
  let failIssue = false;
  const sync = createUninstallUrlSync({
    apiBaseUrl: 'https://hub.kaito.ai',
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    remove: async () => {
      stored = undefined;
    },
    issue: async () => {
      if (failIssue) throw new Error('offline');
      issued += 1;
      return { token: `tok${issued}` };
    },
    setUrl: async (url) => {
      urls.push(url);
    },
    log: () => {},
  });
  return {
    sync,
    urls,
    stored: () => stored,
    issued: () => issued,
    failNext: (v: boolean) => {
      failIssue = v;
    },
  };
}

test('url points at the BFF uninstall route with the token', () => {
  assert.equal(uninstallUrl('https://hub.kaito.ai', 'a-b_c'), 'https://hub.kaito.ai/api/v1/extension/uninstall?t=a-b_c');
});

test('signed in: issues one token, stores it, sets the url; repeat syncs are no-ops', async () => {
  const s = setup();
  await s.sync.sync('did:a');
  await s.sync.sync('did:a');
  assert.equal(s.issued(), 1);
  assert.deepEqual(s.stored(), { privyId: 'did:a', token: 'tok1' });
  assert.deepEqual(s.urls, ['https://hub.kaito.ai/api/v1/extension/uninstall?t=tok1']);
});

test('a stored token for the same user is reused after a worker restart', async () => {
  const s = setup({ privyId: 'did:a', token: 'old' });
  await s.sync.sync('did:a');
  assert.equal(s.issued(), 0);
  assert.deepEqual(s.urls, ['https://hub.kaito.ai/api/v1/extension/uninstall?t=old']);
});

test('switching account issues a new token for the new user', async () => {
  const s = setup({ privyId: 'did:a', token: 'old' });
  await s.sync.sync('did:b');
  assert.equal(s.issued(), 1);
  assert.deepEqual(s.stored(), { privyId: 'did:b', token: 'tok1' });
});

test('signed out: clears the stored token and the url once', async () => {
  const s = setup();
  await s.sync.sync('did:a');
  await s.sync.sync(undefined);
  await s.sync.sync(undefined);
  assert.equal(s.stored(), undefined);
  assert.deepEqual(s.urls.slice(1), ['']);
});

test('a failed issue is retried on the next sync', async () => {
  const s = setup();
  s.failNext(true);
  await s.sync.sync('did:a');
  assert.deepEqual(s.urls, []);
  s.failNext(false);
  await s.sync.sync('did:a');
  assert.equal(s.urls.length, 1);
});
