import type { ExtensionProof } from './contracts';

export function latestProofByVerifier(proofs: ExtensionProof[]): Record<string, ExtensionProof> {
  const map: Record<string, ExtensionProof> = {};
  for (const proof of proofs) {
    const seen = map[proof.verifierId];
    if (!seen || proof.verifiedAt > seen.verifiedAt) map[proof.verifierId] = proof;
  }
  return map;
}
