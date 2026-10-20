import { storage } from 'wxt/utils/storage';
import type { PendingAuthIntentMap } from '@/shared/storage';

export const pendingAuthIntentsItem = storage.defineItem<PendingAuthIntentMap>(
  'session:kaito.pendingAuthIntents',
  { fallback: {} },
);
