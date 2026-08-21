export type ExtensionMeResponse = {
  privyId?: string;
  email?: string;
  twitterId?: string;
  username?: string;
  avatarUrl?: string;

  kaitoName?: string;

  activityInsightsEnabled?: boolean | null;

  termsAccepted?: boolean;
};

export type AcceptTermsResponse = {
  accepted: true;
  termsVersion: string;
};

export type ActivityInsightsPreference = {
  key: string;
  enabled: boolean;
  updatedAt: number | null;
};

export type ExtensionPreference = {
  key: string;
  enabled: boolean | null;
  updatedAt: number | null;
};

export type ListPreferencesResponse = { preferences: ExtensionPreference[] };

export const TRADING_TOTALS_PUBLIC_KEY = 'trading_totals_public';

export type ExtensionVerifier = {
  id: string;
  name: string;
  platform: string;
  unit?: string;
  guide: {
    url: string;
    message: string;
  };

  requiresPageSignedInitialTraffic?: boolean;
};

export type SignResponse = {
  requestId: string;
  signedRequest: string;
  template?: PrimusTemplateMetadata;
};

export type PrimusTemplateMetadata = {
  id: string;
  dataSource: string;
  dataPageTemplate: string;
  dataSourceTemplate: string;
  sslCipherSuite?: string;
  name?: string;
  description?: string;
  category?: string;
};

export type SubmitProofResponse = {
  proofId: string;
  extractedValue: string;
  unit?: string;
  verifiedAt: number;
};

export type CreateSessionResponse = {
  sessionToken: string;
  me: ExtensionMeResponse;
};

export type AutoVerification = {
  verifierId: string;
  enabled: boolean;
  targetUrlExpressions: string[];
  updatedAt: number;
};

export type ListAutoVerificationsResponse = {
  autoVerifications: AutoVerification[];
};

export type ExtensionProof = {
  verifierId: string;
  proofId: string;
  extractedValue: string;
  unit?: string;
  platform?: string;
  category?: string;
  verifiedAt: number;

  platformUserId?: string;
};

export type ListProofsResponse = {
  proofs: ExtensionProof[];
};

export type PlatformBinding = {
  platform: string;

  platformUserId: string;
  verifierId: string;

  boundAt: number;
  lastVerifiedAt: number;
};

export type ListPlatformBindingsResponse = {
  bindings: PlatformBinding[];
};

export type UnbindPlatformResponse = {
  platform: string;

  unbound: boolean;
  releasedAccounts: number;

  revokedProofs: number;
};

export type Attestation = Record<string, unknown> & {
  taskId?: string;
  recipient?: string;
  timestamp?: number;
};

export type ApiErrorBody = {
  message?: string;
  reason?: string;
  proofId?: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | string | undefined;
  readonly reason: string | undefined;

  constructor(status: number, body: ApiErrorBody | string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.reason =
      typeof body === 'object' && body !== null
        ? String(body.reason || body.message || body.code || '') || undefined
        : undefined;
  }
}
