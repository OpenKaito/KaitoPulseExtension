import type { Attestation, ExtensionMeResponse } from '@/shared/contracts';
import type { ProofRunSummary } from '@/shared/messages';
import {
  activeProofProgressItem,
  bootstrapFreshAtItem,
  lastResultItem,
  meCacheItem,
  sessionItem,
  verifySnapshotItem,
  type VerifySnapshot,
} from '@/shared/storage';
import {
  readPrivateValue,
  writePrivateValue,
  removePrivateValue,
} from '@/background/private-storage';
import { clearDebugRequests } from '@/background/debug-log';

let migration: Promise<void> | undefined;

export function migratePrivateStorage(): Promise<void> {
  migration ??= (async () => {
    const legacy = await chrome.storage.local.get([
      'kaito.session',
      'kaito.lastAttestation',
      'kaito.lastResult',
    ]);
    const session = legacy['kaito.session'] as StoredSession | undefined;
    if (session?.sessionToken) {
      await writePrivateValue('session', session);
      await sessionItem.setValue({ signedInAt: session.signedInAt });
    }
    const result = legacy['kaito.lastResult'] as
      | (ProofRunSummary & { attestation?: Attestation })
      | undefined;
    const attestation = legacy['kaito.lastAttestation'] ?? result?.attestation;
    if (attestation) {
      await writePrivateValue('attestation', attestation);
    }
    if (result?.attestation) {
      const { attestation: _attestation, ...summary } = result;
      await lastResultItem.setValue(summary);
    }
    await chrome.storage.local.remove('kaito.lastAttestation');
  })().catch((error) => {
    migration = undefined;
    throw error;
  });
  return migration;
}

export type StoredSession = {
  sessionToken: string;
  signedInAt: number;
};

export async function getStoredSession(): Promise<StoredSession | undefined> {
  await migratePrivateStorage();
  return readPrivateValue<StoredSession>('session');
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  await migratePrivateStorage();
  await writePrivateValue('session', session);
  await sessionItem.setValue({ signedInAt: session.signedInAt });
}

export async function clearStoredSession(): Promise<void> {
  await migratePrivateStorage();
  clearDebugRequests();
  await Promise.all([
    removePrivateValue('session'),
    removePrivateValue('attestation'),
    sessionItem.removeValue(),
    meCacheItem.removeValue(),
    lastResultItem.removeValue(),
    activeProofProgressItem.removeValue(),

    verifySnapshotItem.removeValue(),
    bootstrapFreshAtItem.removeValue(),
  ]);
}

export async function setVerifySnapshot(snapshot: VerifySnapshot): Promise<void> {
  await verifySnapshotItem.setValue(snapshot);
}

export async function getVerifySnapshot(): Promise<VerifySnapshot | undefined> {
  return (await verifySnapshotItem.getValue()) ?? undefined;
}

export async function getBootstrapFreshAt(): Promise<number | undefined> {
  return (await bootstrapFreshAtItem.getValue()) ?? undefined;
}

export async function setBootstrapFreshAt(at: number): Promise<void> {
  await bootstrapFreshAtItem.setValue(at);
}

export async function getCachedMe(): Promise<ExtensionMeResponse | undefined> {
  return (await meCacheItem.getValue()) ?? undefined;
}

export async function setCachedMe(me: ExtensionMeResponse): Promise<void> {
  await meCacheItem.setValue(me);
}

export async function getLastResult(): Promise<ProofRunSummary | undefined> {
  return (await lastResultItem.getValue()) ?? undefined;
}

export async function setLastResult(result: ProofRunSummary): Promise<void> {
  await lastResultItem.setValue(result);
}

export async function clearLastResult(): Promise<void> {
  await lastResultItem.removeValue();
}

export async function getLastAttestation(): Promise<Attestation | undefined> {
  await migratePrivateStorage();
  return readPrivateValue<Attestation>('attestation');
}

export async function setLastAttestation(attestation: Attestation | null): Promise<void> {
  await migratePrivateStorage();
  if (attestation === null) await removePrivateValue('attestation');
  else await writePrivateValue('attestation', attestation);
}
