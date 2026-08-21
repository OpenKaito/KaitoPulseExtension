
import type { AttentionServeEvent } from '@/shared/attention';
import { SERVE_SET_MESSAGE, type AttentionServeSetMessage } from './serve-set-extractor';

const MAX_EVENTS_PER_MESSAGE = 400;

function isValidEvent(value: unknown): value is AttentionServeEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.tweetId === 'string' &&
    (e.authorHandle === null || typeof e.authorHandle === 'string') &&
    (e.authorTwitterId === null || typeof e.authorTwitterId === 'string') &&
    typeof e.servedAt === 'number' &&
    typeof e.sourceOp === 'string' &&
    (e.entryKind === 'tweet' || e.entryKind === 'retweet' || e.entryKind === 'promoted')
  );
}

export function startServeSetListener(onServeEvents: (events: AttentionServeEvent[]) => void): () => void {
  const listener = (event: MessageEvent): void => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data as Partial<AttentionServeSetMessage> | null;
    if (!data || data.source !== SERVE_SET_MESSAGE || !Array.isArray(data.events)) return;
    const valid = data.events.filter(isValidEvent).slice(0, MAX_EVENTS_PER_MESSAGE);
    if (valid.length > 0) onServeEvents(valid);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
