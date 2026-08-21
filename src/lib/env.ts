import { DEFAULT_CONNECT_ORIGIN, toOriginList } from '@/shared/connect-origins';

const RAW_BASE_URL = (import.meta.env.VITE_KAITO_API_BASE_URL as string | undefined) || 'http://localhost:8080';

const RAW_CONNECT_ORIGIN = (import.meta.env.VITE_KAITO_CONNECT_URL as string | undefined) || DEFAULT_CONNECT_ORIGIN;
const RAW_MODE = (import.meta.env.VITE_KAITO_ENV as string | undefined) || (import.meta.env.MODE as string | undefined) || 'dev';

declare const __KAITO_BUILD_COMMIT__: string | undefined;

const RAW_BUILD_COMMIT =
  typeof __KAITO_BUILD_COMMIT__ === 'string' && __KAITO_BUILD_COMMIT__ ? __KAITO_BUILD_COMMIT__ : 'local';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

const connectAllowedOrigins = toOriginList(RAW_CONNECT_ORIGIN);
const connectOrigin = connectAllowedOrigins[0] || DEFAULT_CONNECT_ORIGIN;

export const ENV = {
  apiBaseUrl: normalizeBaseUrl(RAW_BASE_URL),
  connectAllowedOrigins,
  connectOrigin,
  isDev: RAW_MODE !== 'production',
  buildCommit: RAW_BUILD_COMMIT,
};

export function logDev(...args: unknown[]) {
  if (ENV.isDev) {
    console.log('[kaito-ext]', ...args);
  }
}
