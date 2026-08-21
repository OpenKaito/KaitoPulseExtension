
import type { HoverCardResult } from '@/shared/social-card';

export async function applyHoverCardMock(_twitterId: string, result: HoverCardResult): Promise<HoverCardResult> {
  return result;
}

export function watchHoverCardMock(_cb: (description: string) => void): () => void {
  return () => {};
}
