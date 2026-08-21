import { ApiError } from '@/shared/contracts';

export type AuthedErrorResponse = { error: string; status?: number };

export function toAuthedError(error: unknown, fallbackMessage: string): AuthedErrorResponse {
  if (error instanceof ApiError) {
    return { error: error.reason || error.message, status: error.status };
  }
  if (error instanceof Error && error.message === 'sign_in_required') {
    return { error: 'sign_in_required', status: 401 };
  }
  return { error: (error as Error)?.message || fallbackMessage };
}
