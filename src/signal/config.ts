import { ENV } from '@/lib/env';

export const SIGNAL_CONFIG = {
  cacheFreshTtlMs: 5 * 60_000,

  cacheNegativeTtlMs: 60_000,

  cacheErrorBackoffMs: 5_000,

  cacheMaxEntries: 500,
  isDev: ENV.isDev,
} as const;
