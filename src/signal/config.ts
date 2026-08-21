import { ENV } from '@/lib/env';

const RAW_SELECTOR_CONFIG_URL = (import.meta.env.VITE_SIGNAL_SELECTOR_CONFIG_URL as string | undefined) || '';

export const SIGNAL_CONFIG = {

  selectorConfigUrl: RAW_SELECTOR_CONFIG_URL,

  cacheFreshTtlMs: 5 * 60_000,

  cacheNegativeTtlMs: 60_000,

  cacheErrorBackoffMs: 5_000,

  cacheMaxEntries: 500,
  isDev: ENV.isDev,
} as const;
