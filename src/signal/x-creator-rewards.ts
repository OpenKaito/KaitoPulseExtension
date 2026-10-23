import type { XCreatorRewardsPagePayload } from '@/shared/x-creator-rewards';
import { X_WEB_PUBLIC_BEARER } from '@/verify/x-graphql-prefetch';

export const X_CREATOR_REWARDS_PAGE_URL = 'https://x.com/i/jfapi/creators/original_content_rewards';

export const READ_X_CREATOR_REWARDS_MESSAGE = 'kaito:readXCreatorRewards';

const MAX_BODY_BYTES = 64 * 1024;

export type XCreatorRewardsReadResult =
  | { ok: true; page: XCreatorRewardsPagePayload }
  | { ok: false; error: 'no_identity' | 'unavailable'; status?: number };

export function readCookieValue(cookie: string, name: string): string | undefined {
  const prefix = `${name}=`;
  return cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function readXCreatorRewardsPage(
  twitterId: string | null,
  csrf: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<XCreatorRewardsReadResult> {
  if (!twitterId || !csrf) return { ok: false, error: 'no_identity' };

  let response: Response;
  try {
    response = await fetchImpl(X_CREATOR_REWARDS_PAGE_URL, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        authorization: X_WEB_PUBLIC_BEARER,
        'x-csrf-token': csrf,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
      },
    });
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  if (!response.ok) return { ok: false, error: 'unavailable', status: response.status };

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BODY_BYTES) {
    return { ok: false, error: 'unavailable', status: response.status };
  }
  const jfTag = response.headers.get('x-jf-tag');
  return { ok: true, page: { twitterId, ...(jfTag ? { jfTag } : {}), body: toBase64(bytes) } };
}
