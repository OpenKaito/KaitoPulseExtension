import assert from 'node:assert/strict';
import test from 'node:test';

import { redactFailureMessage, navigationTargetForLog } from '../src/shared/verifier-url.ts';

test('keeps origin and path, drops query and hash', () => {
  assert.equal(
    navigationTargetForLog('https://x.com/i/flow/login?redirect_after_login=%2Fi%2Faccount_analytics#token=abc'),
    'https://x.com/i/flow/login',
  );
});

test('opaque and browser-internal urls only report their scheme', () => {
  assert.equal(navigationTargetForLog('about:blank'), 'about:');
  assert.equal(navigationTargetForLog('data:text/html,secret'), 'data:');
  assert.equal(navigationTargetForLog('chrome-error://chromewebdata/'), 'chrome-error:');
});

test('garbage does not throw', () => {
  assert.equal(navigationTargetForLog('not a url'), 'unparseable');
});

test('only known route words and the guide path survive; every other segment is masked', () => {
  assert.equal(
    navigationTargetForLog('https://id.example/callback/shortoauthcode'),
    'https://id.example/callback/:x',
  );
  assert.equal(
    navigationTargetForLog('https://polymarket.com/portfolio/0xabc', 'https://polymarket.com/portfolio'),
    'https://polymarket.com/portfolio/:x',
  );
  assert.equal(
    navigationTargetForLog('https://www.binance.com/en/my/wallet/account/futures', 'https://www.binance.com/en/my/wallet/account/futures'),
    'https://www.binance.com/en/my/wallet/account/futures',
  );
});

test('path segments that could carry tokens, ids or emails are masked', () => {
  assert.equal(navigationTargetForLog('https://x.com/i/flow/login'), 'https://x.com/i/flow/login');
  assert.equal(
    navigationTargetForLog('https://example.com/reset/a1b2c3d4e5/users/alice@example.com'),
    'https://example.com/:x/:x/:x/:x',
  );
  assert.equal(navigationTargetForLog('https://x.com/someone/status/1234567890'), 'https://x.com/:x/status/:x');
  assert.equal(
    navigationTargetForLog('https://example.com/reset/abcdefghijklmnopqrstuvwxyz'),
    'https://example.com/:x/:x',
  );
});

test('urls inside failure messages lose their query and hash, and other secret fields are redacted', () => {
  const message = redactFailureMessage(
    '{"url":"https://id.example/callback?code=abcde#state=x","api_key":"k1","private_key":"pk","mnemonic":"word word"}',
  );
  for (const secret of ['abcde', 'state=x', 'k1', '"pk"', 'word word']) {
    assert.ok(!message.includes(secret), secret);
  }
  assert.ok(message.includes('https://id.example/callback'));
});

test('redaction stays fast on hostile input', () => {
  const started = Date.now();
  redactFailureMessage(`a@a${'.'.repeat(100_000)}`);
  redactFailureMessage(`${'a'.repeat(50_000)}@`);
  assert.ok(Date.now() - started < 200);
});

test('failure messages keep diagnostics but lose credentials, emails and long opaque tokens', () => {
  const message = redactFailureMessage(
    '00013: Target data missing: {"title":"Target data missing","path":"$.data.result.viewer","url":"https://x.com/i/api/graphql/_P1caq0YB4SVuEtFLPDMfQ/accountOverviewDailyQuery","authorization":"Bearer AAAAabc123","headers":"Cookie: ct0=deadbeef; auth_token=xyz","owner":"alice@example.com","sig":"0123456789abcdef0123456789abcdef0123"}',
  );
  assert.ok(message.includes('$.data.result.viewer'));
  assert.ok(message.includes('_P1caq0YB4SVuEtFLPDMfQ/accountOverviewDailyQuery'));
  for (const secret of ['AAAAabc123', 'deadbeef', 'xyz', 'alice@example.com', '0123456789abcdef0123456789abcdef0123']) {
    assert.ok(!message.includes(secret), secret);
  }
});

test('X feature paths under /i/ keep their lowercase words; handles and ids stay masked', () => {
  assert.equal(
    navigationTargetForLog('https://x.com/i/jf/creators/original_content_rewards'),
    'https://x.com/i/jf/creators/original_content_rewards',
  );
  assert.equal(
    navigationTargetForLog('https://x.com/i/account_analytics/content', 'https://x.com/i/account_analytics'),
    'https://x.com/i/account_analytics/content',
  );
  assert.equal(navigationTargetForLog('https://x.com/i/web/status/1849000000000000000'), 'https://x.com/i/web/status/:x');
  assert.equal(navigationTargetForLog('https://x.com/someone/status/1849'), 'https://x.com/:x/status/:x');
  assert.equal(navigationTargetForLog('https://polymarket.com/i/abc/def'), 'https://polymarket.com/i/:x/:x');
});

test('long snake_case error codes survive redaction; opaque tokens do not', () => {
  assert.equal(
    redactFailureMessage('primus_identity_initialization_failed: no_identity'),
    'primus_identity_initialization_failed: no_identity',
  );
  assert.equal(redactFailureMessage('id AbCdEf0123456789AbCdEf0123456789xyz'), 'id [redacted]');
});
