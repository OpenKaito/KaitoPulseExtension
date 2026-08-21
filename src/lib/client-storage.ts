import type { Attestation, ExtensionMeResponse } from '@/shared/contracts';
import type { ProofRunSummary } from '@/shared/messages';
import {
  activeProofProgressItem,
  lastAttestationItem,
  lastResultItem,
  meCacheItem,
  sessionItem,
  verifySnapshotItem,
  type VerifySnapshot,
} from '@/shared/storage';

export type StoredSession = {
  sessionToken: string;
  signedInAt: number;
};

export async function getStoredSession(): Promise<StoredSession | undefined> {
  return (await sessionItem.getValue()) ?? undefined;
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  await sessionItem.setValue(session);
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    sessionItem.removeValue(),
    meCacheItem.removeValue(),
    lastResultItem.removeValue(),
    lastAttestationItem.removeValue(),
    activeProofProgressItem.removeValue(),

    verifySnapshotItem.removeValue(),
  ]);
}

export async function setVerifySnapshot(snapshot: VerifySnapshot): Promise<void> {
  await verifySnapshotItem.setValue(snapshot);
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
  return (await lastAttestationItem.getValue()) ?? undefined;
}

export async function setLastAttestation(attestation: Attestation | null): Promise<void> {
  await lastAttestationItem.setValue(attestation);
}
