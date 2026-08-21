
import type { ExtensionProof, ExtensionVerifier } from '@/shared/contracts';

export type VerifyCategory = 'ai' | 'crypto' | 'trading' | 'social';

export type VerifyKind = 'zktls' | 'wallet' | 'oauth';

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

  detail: {

    requirement: string;

    verifies: string;

    time: string;

    validity: string;

    earn: string[];

    steps: string[];

    footnote: string;
  };
}

export type TaskStatus =
  | { state: 'available' }

  | { state: 'verified'; proof: ExtensionProof; daysSince: number };

export interface VerifyTask {

  id: string;
  meta: PlatformMeta;

  verifier?: ExtensionVerifier;
  status: TaskStatus;
}

export type ResultKind = 'verified' | 'canceled' | 'failed' | 'timeout' | 'login';
