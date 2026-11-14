import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { formatXError } = (await import('../src/verify/x-graphql-prefetch.ts')) as {
  formatXError: (body: unknown) => string | undefined;
};

test('code and message are joined so the reason groups and still reads', () => {
  assert.equal(
    formatXError({ errors: [{ code: 353, message: 'This request requires a matching csrf cookie value.' }] }),
    '353:This request requires a matching csrf cookie value.',
  );
});

test('a code with no message still identifies the failure', () => {
  assert.equal(formatXError({ errors: [{ code: 64 }] }), '64');
});

test('a message with no code keeps the readable reason', () => {
  assert.equal(
    formatXError({ errors: [{ message: 'Could not authenticate you' }] }),
    'Could not authenticate you',
  );
});

test('an @handle in the message is blanked', () => {
  assert.equal(
    formatXError({ errors: [{ code: 63, message: 'User @Rejoicelady1 has been suspended' }] }),
    '63:User @ has been suspended',
  );
});

test('a long digit run (an X user id) is masked, short numbers survive', () => {
  assert.equal(
    formatXError({ errors: [{ message: 'account 1234567890 not found within 2 minutes' }] }),
    'account # not found within 2 minutes',
  );
});

test('a key=value secret is redacted before = is stripped (not left in the clear)', () => {
  assert.equal(
    formatXError({ errors: [{ code: 403, message: 'denied status=200 token=abc' }] }),
    '403:denied status 200 token [redacted]',
  );
});

test('= is still dropped so a message cannot inject a spurious field downstream', () => {
  assert.equal(
    formatXError({ errors: [{ code: 400, message: 'bad foo=bar baz=qux' }] }),
    '400:bad foo bar baz qux',
  );
});

test('a 2xx body with no errors yields nothing', () => {
  assert.equal(formatXError({ data: { viewer_v2: {} } }), undefined);
  assert.equal(formatXError({ errors: [] }), undefined);
  assert.equal(formatXError({}), undefined);
});

test('a hostile or non-object body cannot throw', () => {
  assert.equal(formatXError(undefined), undefined);
  assert.equal(formatXError('nope'), undefined);
  assert.equal(formatXError({ errors: 'nope' }), undefined);
  assert.equal(formatXError({ errors: [null] }), undefined);
  assert.equal(formatXError({ errors: [{ code: '353', message: 42 }] }), undefined);
});
