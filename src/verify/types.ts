import type { ExtensionProof, ExtensionVerifier } from '@/shared/contracts';

export type VerifyCategory = 'ai' | 'crypto' | 'trading' | 'social' | 'referral';

export type VerifyKind = 'zktls' | 'wallet' | 'oauth' | 'server_read';

export type PayTier = 'high' | 'medium' | 'low';

export interface PlatformMeta {
  platform: string;
  displayName: string;
  category: VerifyCategory;

  groupLabel: 'CEX' | 'DEX' | 'AI' | 'Social';
  kind: VerifyKind;

  cardTitle: string;

  cardSubtitle: string;
  payTier: PayTier;

  tile: { letter: string; bg: string; fg: string };

  snapshot?: boolean;

  detail: {
    requirement: string;

    verifies: string;

    alsoReads?: string;

    time: string;

    validity: string;

    earn: string[];

    steps: string[];
  };
}

export type TaskStatus =
  | { state: 'available' }
  | { state: 'verified'; proof: ExtensionProof; daysSince: number };

export interface VerifyTask {
  id: string;
  meta: PlatformMeta;

  category: VerifyCategory;

  verifier?: ExtensionVerifier;
  status: TaskStatus;
}

export type ResultKind = 'verified' | 'canceled' | 'failed' | 'timeout' | 'login';
