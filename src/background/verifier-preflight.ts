import { logDev } from '@/lib/env';
import type { ExtensionVerifier, PrimusTemplateMetadata } from '@/shared/contracts';
import type { ProofErrorCode } from '@/shared/messages';
import type { XCreatorRewardsPagePayload } from '@/shared/x-creator-rewards';
import { readJsonFromVerifierPage, type RunAttestationOptions } from './primus-adapter';

type PreflightErrorCode = Extract<
  ProofErrorCode,
  | 'third_party_login_required'
  | 'unsupported_account_type'
  | 'target_page_not_ready'
  | 'account_mismatch'
  | 'account_not_linked'
>;

export type VerifierPreflightOptions = Pick<
  RunAttestationOptions,
  'onTargetTab' | 'windowId' | 'forceCreateTab'
> & {
  linkedAccountId?: string | null;
  onXCreatorRewardsPage?: (page: XCreatorRewardsPagePayload) => void;
  onXCreatorRewardsUnread?: (status: number | undefined) => void;
};

export class VerifierPreflightError extends Error {
  readonly code: PreflightErrorCode;

  constructor(code: PreflightErrorCode, message: string) {
    super(message);
    this.name = 'VerifierPreflightError';
    this.code = code;
  }
}

export async function runVerifierPreflight(
  verifier: ExtensionVerifier,
  guideUrl: string,
  _template: PrimusTemplateMetadata | undefined,
  options: VerifierPreflightOptions = {},
): Promise<void> {
  try {
    if (verifier.id === 'x_analytics_overview') {
      await preflightXAnalytics(guideUrl, options);
      return;
    }
    logDev('verifier preflight skipped', { verifierId: verifier.id, reason: 'no_rule' });
  } catch (error) {
    if (error instanceof VerifierPreflightError) throw error;
    logDev('verifier preflight inconclusive; continuing to Primus', {
      verifierId: verifier.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function preflightXAnalytics(
  guideUrl: string,
  options: VerifierPreflightOptions = {},
): Promise<void> {
  const result = await readJsonFromVerifierPage<{
    overview?: { ok?: boolean; status?: number; errors?: string[] };
    viewerId?: string | null;
    reason?: string;
    creatorRewards?: { status: number; jfTag?: string; body?: string } | null;
  }>(guideUrl, '__kaito_preflight_x_analytics__', options);

  if (!result.ok || !result.value || typeof result.value !== 'object') {
    throw new VerifierPreflightError('target_page_not_ready', 'x_preflight_unavailable');
  }
  const value = result.value;
  if (value.reason === 'wrong_host') {
    throw new VerifierPreflightError('target_page_not_ready', 'x_page_not_ready');
  }
  if (value.reason === 'not_signed_in') {
    throw new VerifierPreflightError('third_party_login_required', 'x_login_required');
  }
  assertLinkedXAccount(value.viewerId, options.linkedAccountId);
  handOffCreatorRewardsPage(value.viewerId, value.creatorRewards, options);
  const overview = value.overview;
  if (!overview) {
    logDev('x analytics preflight inconclusive; overview not read');
    return;
  }
  if (overview.status === 401 || overview.status === 403 || overview.status === 404) {
    throw new VerifierPreflightError('third_party_login_required', 'x_login_required');
  }
  const denied = (overview.errors ?? []).some(
    (message) => /denied by access control/i.test(message) || /missing ldapgroup/i.test(message),
  );
  if (denied) {
    throw new VerifierPreflightError('unsupported_account_type', 'x_analytics_requires_premium');
  }
  if (overview.ok !== true) {
    logDev('x analytics preflight inconclusive; overview non-ok', { status: overview.status });
  }
}

function handOffCreatorRewardsPage(
  viewerId: string | null | undefined,
  page: { status: number; jfTag?: string; body?: string } | null | undefined,
  options: VerifierPreflightOptions,
): void {
  if (!viewerId || !page?.body) {
    logDev('x creator rewards page not read during preflight', { status: page?.status });
    options.onXCreatorRewardsUnread?.(page?.status);
    return;
  }
  options.onXCreatorRewardsPage?.({
    twitterId: viewerId,
    ...(page.jfTag ? { jfTag: page.jfTag } : {}),
    body: page.body,
  });
}

function assertLinkedXAccount(
  viewerId: string | null | undefined,
  linkedAccountId: string | null | undefined,
): void {
  if (linkedAccountId === undefined) {
    logDev('x analytics preflight: linked X unknown; leaving the identity check to KEBS');
    return;
  }
  if (linkedAccountId === null) {
    throw new VerifierPreflightError('account_not_linked', 'x_account_not_linked');
  }
  if (!viewerId) {
    logDev('x analytics preflight: twid cookie unreadable; leaving the identity check to KEBS');
    return;
  }
  if (viewerId !== linkedAccountId) {
    throw new VerifierPreflightError('account_mismatch', 'x_account_mismatch');
  }
}
