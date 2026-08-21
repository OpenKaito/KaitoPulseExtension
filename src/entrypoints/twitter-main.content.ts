import {
  extractTidPairs,
  TID_MAP_MESSAGE,
  type TidMapMessage,
  type TidPair,
} from '@/signal/graphql-id-extractor';
import {
  DEFAULT_SERVE_SET_OPERATIONS,
  extractServeSet,
  SERVE_SET_MESSAGE,
  type AttentionServeSetMessage,
} from '@/attention/serve-set-extractor';
import { armGraphqlPrefetch, captureGraphqlAuth, forceGraphqlPrefetch } from '@/verify/x-graphql-prefetch';
import { isGraphqlPrefetchRequest } from '@/verify/x-graphql-prefetch-message';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://*.x.com/*'],

  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installInterceptor();
  },
});

const INSTALL_FLAG = '__kaitoTidInterceptorInstalled';

function shouldInspect(url: string): boolean {
  return (
    url.includes('/i/api/') ||
    url.includes('/graphql/') ||
    /\/\/api\.(?:x|twitter)\.com\//.test(url)
  );
}

function post(pairs: TidPair[]): void {
  const message: TidMapMessage = { source: TID_MAP_MESSAGE, pairs };
  try {
    window.postMessage(message, window.location.origin);
  } catch {

  }
}

function graphqlOperationName(url: string): string | null {
  return url.match(/\/graphql\/[^/?]+\/([^/?]+)/)?.[1] ?? null;
}

function postServeSet(json: unknown, sourceOp: string): void {
  const events = extractServeSet(json, sourceOp);
  if (events.length === 0) return;
  const message: AttentionServeSetMessage = { source: SERVE_SET_MESSAGE, events };
  try {
    window.postMessage(message, window.location.origin);
  } catch {

  }
}

function safeParse(text: string): unknown {
  const trimmed = text.trimStart();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function harvestFromJson(json: unknown, url: string): void {
  const pairs = extractTidPairs(json);
  if (pairs.length > 0) post(pairs);

  const op = graphqlOperationName(url);
  if (op && DEFAULT_SERVE_SET_OPERATIONS.has(op)) postServeSet(json, op);
}

const PAGE_WARMED_OPERATION = 'Viewer';

function harvestRequestHeaders(url: string, headers: Record<string, string>): void {
  if (!url.includes('/graphql/')) return;
  captureGraphqlAuth(headers);
  armGraphqlPrefetch(PAGE_WARMED_OPERATION);
}

function headersToRecord(source: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source) return out;
  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    source.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(source)) {
    for (const [key, value] of source) out[key] = value;
    return out;
  }
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function installInterceptor(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[INSTALL_FLAG]) return;
  w[INSTALL_FLAG] = true;

  patchFetch();
  patchXhr();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') armGraphqlPrefetch(PAGE_WARMED_OPERATION);
  });
  window.addEventListener('pageshow', () => armGraphqlPrefetch(PAGE_WARMED_OPERATION));

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (!isGraphqlPrefetchRequest(event.data)) return;
    forceGraphqlPrefetch(event.data.operation);
  });
}

function patchFetch(): void {
  const original = window.fetch;
  if (typeof original !== 'function') return;

  window.fetch = function patchedFetch(
    this: unknown,
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const result = original.apply(this, args);
    try {
      const input = args[0];
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : '';
      if (url) {
        const init = args[1];
        const requestHeaders =
          input instanceof Request && !init?.headers ? headersToRecord(input.headers) : headersToRecord(init?.headers);
        harvestRequestHeaders(url, requestHeaders);
      }
      if (url && shouldInspect(url)) {
        result.then(
          (response) => {

            response
              .clone()
              .text()
              .then((text) => {
                const json = safeParse(text);
                if (json) harvestFromJson(json, url);
              })
              .catch(() => {});
          },
          () => {},
        );
      }
    } catch {

    }
    return result;
  };
}

function patchXhr(): void {
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const originalSetRequestHeader = proto.setRequestHeader;
  const URL_KEY = '__kaitoTidUrl';
  const HEADERS_KEY = '__kaitoTidHeaders';

  const patchedOpen = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]): void {
    try {
      (this as unknown as Record<string, unknown>)[URL_KEY] =
        typeof url === 'string' ? url : url instanceof URL ? url.href : '';
    } catch {

    }
    return (originalOpen as (...a: unknown[]) => void).apply(this, [method, url, ...rest]);
  };

  const patchedSetRequestHeader = function (this: XMLHttpRequest, name: string, value: string): void {
    try {
      const store = this as unknown as Record<string, unknown>;
      const headers = (store[HEADERS_KEY] as Record<string, string> | undefined) ?? {};
      headers[name] = value;
      store[HEADERS_KEY] = headers;
    } catch {

    }
    return (originalSetRequestHeader as (...a: unknown[]) => void).apply(this, [name, value]);
  };

  const patchedSend = function (this: XMLHttpRequest, ...args: unknown[]): void {
    try {
      const store = this as unknown as Record<string, unknown>;
      const sentUrl = store[URL_KEY] as string | undefined;
      if (sentUrl) {
        harvestRequestHeaders(sentUrl, (store[HEADERS_KEY] as Record<string, string> | undefined) ?? {});
      }
    } catch {

    }
    try {
      const url = (this as unknown as Record<string, unknown>)[URL_KEY] as string | undefined;
      if (url && shouldInspect(url)) {
        this.addEventListener('load', () => {
          try {
            const type = this.responseType;
            if (type !== '' && type !== 'text' && type !== 'json') return;
            const raw = type === 'json' ? this.response : this.responseText;
            const json = typeof raw === 'string' ? safeParse(raw) : raw;
            if (json && typeof json === 'object') harvestFromJson(json, url);
          } catch {

          }
        });
      }
    } catch {

    }
    return (originalSend as (...a: unknown[]) => void).apply(this, args);
  };

  proto.open = patchedOpen as typeof proto.open;
  proto.send = patchedSend as typeof proto.send;
  proto.setRequestHeader = patchedSetRequestHeader as typeof proto.setRequestHeader;
}
