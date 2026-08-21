import { SIGNAL_CONFIG } from '../config';
import type { SignalFetchOptions } from '../types';
import { createLogger } from '../logger';
import { finishDebugRequest, startDebugRequest } from '@/background/debug-log';

const logger = createLogger('client');

function resolveUrl(url: string, baseURL?: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (baseURL || '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function normalizeOrigin(u: URL): string {
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  return `${u.protocol}//${host}:${u.port}`;
}

export function assertAllowedTarget(fullUrl: string): void {
  const configuredBases = [SIGNAL_CONFIG.selectorConfigUrl].filter(Boolean);
  if (configuredBases.length === 0) {
    throw new Error('proxy_blocked: signal API base URL is not configured');
  }

  let target: URL;
  try {
    target = new URL(fullUrl);
  } catch {
    throw new Error('proxy_blocked: invalid target URL');
  }

  const allowedOrigins = new Set<string>();
  for (const base of configuredBases) {
    try {
      allowedOrigins.add(normalizeOrigin(new URL(base)));
    } catch {

    }
  }

  if (!allowedOrigins.has(normalizeOrigin(target))) {
    throw new Error(`proxy_blocked: ${target.origin} is not an allowed target`);
  }
}

export async function backgroundFetch<T>(url: string, options: SignalFetchOptions = {}): Promise<T> {
  const fullUrl = resolveUrl(url, options.baseURL);
  assertAllowedTarget(fullUrl);
  logger.log(`[Background] Direct fetch: ${fullUrl}`);

  const headers: Record<string, string> = { ...(options.headers || {}) };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = headers['content-type'] || 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const method = options.method || (options.body !== undefined ? 'POST' : 'GET');
  const debugId = startDebugRequest({
    source: 'signal-proxy',
    method,
    url: fullUrl,
    requestBody: options.body,
  });

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
      cache: 'no-store',

      redirect: options.redirect ?? 'follow',
    });

    if (response.type === 'opaqueredirect') {
      finishDebugRequest(debugId, {
        status: response.status,
        ok: false,
        error: 'proxy_blocked: redirect not allowed',
      });
      throw new Error('proxy_blocked: redirect not allowed');
    }

    if (!response.ok) {
      finishDebugRequest(debugId, {
        status: response.status,
        ok: false,
        error: `fetch_failed ${response.status}: ${response.statusText}`,
      });
      throw new Error(`fetch_failed ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const parsed = text ? JSON.parse(text) as unknown : undefined;
    logger.log(`[Background] Fetch success: ${fullUrl}`);
    finishDebugRequest(debugId, {
      status: response.status,
      ok: true,
      responseBody: parsed,
    });
    return parsed as T;
  } catch (error) {
    logger.error(`[Background] Fetch failed: ${fullUrl}`, error);
    finishDebugRequest(debugId, {
      ok: false,
      error: (error as Error)?.message || String(error),
    });
    throw error;
  }
}
