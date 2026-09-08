import { storage } from 'wxt/utils/storage';
import type { PendingAuthIntentMap } from '@/shared/storage';

/** Background-only: Chrome does not expose storage.session to content scripts by default. */
export const pendingAuthIntentsItem = storage.defineItem<PendingAuthIntentMap>(
  'session:kaito.pendingAuthIntents',
  { fallback: {} },
);
