
export const IMG_PROXY_BASE = 'https://img.kaito.ai';

const IMG_WIDTH_BUCKETS = [
  16, 32, 48, 64, 96, 128, 256, 384, 512, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
];

export function imgBucket(cssPx: number): number {
  const target = cssPx * (globalThis.devicePixelRatio || 1);
  return IMG_WIDTH_BUCKETS.find((s) => s >= target) ??
    IMG_WIDTH_BUCKETS[IMG_WIDTH_BUCKETS.length - 1];
}

export function buildImgProxyUrl(src: string, width: number): string {
  const doubleEncoded = encodeURIComponent(encodeURIComponent(src));
  return `${IMG_PROXY_BASE}/v2/${doubleEncoded}//w=${width}&q=80`;
}

const XCOM_IMG_ALLOWED_HOSTS = ['twimg.com', 'cdn.x.com', 'cdn.twitter.com'];

export function isXcomRenderableHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return XCOM_IMG_ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const DIRECT_FETCH_HOSTS = ['app.hyperliquid.xyz'];

export function isDirectFetchHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return DIRECT_FETCH_HOSTS.includes(host);
  } catch {
    return false;
  }
}
