const KEY = 'kaito.expectedAccount';
const TTL_MS = 30 * 60 * 1000;

export const NEW_ACCOUNT_INTENT = 'kaito:new-account';

export function updatesExistingAccount(expected: string | undefined): boolean {
  return Boolean(expected) && expected !== NEW_ACCOUNT_INTENT;
}

type Stored = { verifierId: string; accountId: string; at: number };

export function cleanExpectedAccountId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : undefined;
}

export async function setExpectedAccount(
  verifierId: string,
  accountId: string | undefined,
): Promise<void> {
  if (accountId) {
    await chrome.storage.session.set({
      [KEY]: { verifierId, accountId, at: Date.now() } satisfies Stored,
    });
  } else {
    await chrome.storage.session.remove(KEY);
  }
}

export async function expectedAccountFor(verifierId: string): Promise<string | undefined> {
  const stored = (await chrome.storage.session.get(KEY))[KEY] as Stored | undefined;
  if (!stored || stored.verifierId !== verifierId) return undefined;
  if (Date.now() - stored.at > TTL_MS) {
    await chrome.storage.session.remove(KEY);
    return undefined;
  }
  return stored.accountId;
}

export async function clearExpectedAccount(verifierId: string): Promise<void> {
  const stored = (await chrome.storage.session.get(KEY))[KEY] as Stored | undefined;
  if (stored?.verifierId === verifierId) await chrome.storage.session.remove(KEY);
}
