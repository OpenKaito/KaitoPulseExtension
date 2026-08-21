import { api } from '@/lib/api';
import type { AcceptTermsActionResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall, applyTermsAccepted } from './worker-core';

const logger = createLogger('terms');

export async function handleAcceptTerms(): Promise<AcceptTermsActionResponse> {
  try {
    const result = await authedCall((token) => api.acceptTerms(token));
    await applyTermsAccepted();
    return { result };
  } catch (error) {
    logger.error('acceptTerms error', error);
    return toAuthedError(error, 'accept terms failed');
  }
}
