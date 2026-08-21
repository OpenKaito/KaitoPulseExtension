import type { FetchImageResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { buildImgProxyUrl } from '@/signal/image-proxy';
import { finishDebugRequest, startDebugRequest } from './debug-log';

const logger = createLogger('background');

const imageCache = new Map<string, string>();
const IMAGE_CACHE_MAX = 200;

const rawImageCache = new Map<string, string>();
const RAW_IMAGE_CACHE_MAX = 200;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function handleFetchImage(url: string, width: number): Promise<FetchImageResponse> {
  const key = `${url}@${width}`;
  const cached = imageCache.get(key);
  if (cached) return { dataUri: cached };
  const proxyUrl = buildImgProxyUrl(url, width);
  const debugId = startDebugRequest({
    source: 'image-proxy',
    method: 'GET',
    url: proxyUrl,
    requestBody: { url, width },
  });

  try {

    const resp = await fetch(proxyUrl, {
      headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
    });
    if (!resp.ok) {
      const error = `image proxy responded ${resp.status}`;
      finishDebugRequest(debugId, { status: resp.status, ok: false, error });
      return { error };
    }

    const blob = await resp.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dataUri = `data:${blob.type || 'image/webp'};base64,${bytesToBase64(bytes)}`;

    if (imageCache.size >= IMAGE_CACHE_MAX) {
      const oldest = imageCache.keys().next().value;
      if (oldest !== undefined) imageCache.delete(oldest);
    }
    imageCache.set(key, dataUri);
    finishDebugRequest(debugId, {
      status: resp.status,
      ok: true,
      responseBody: {
        contentType: blob.type || 'image/webp',
        bytes: bytes.length,
        dataUriChars: dataUri.length,
      },
    });
    return { dataUri };
  } catch (error) {
    logger.error('fetchImage error', error);
    finishDebugRequest(debugId, {
      ok: false,
      error: (error as Error)?.message || 'image fetch failed',
    });
    return { error: (error as Error)?.message || 'image fetch failed' };
  }
}

export async function handleFetchRawImage(url: string): Promise<FetchImageResponse> {
  const cached = rawImageCache.get(url);
  if (cached) return { dataUri: cached };
  const debugId = startDebugRequest({
    source: 'image-proxy',
    method: 'GET',
    url,
    requestBody: { url },
  });

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const error = `raw image fetch responded ${resp.status}`;
      finishDebugRequest(debugId, { status: resp.status, ok: false, error });
      return { error };
    }

    const blob = await resp.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dataUri = `data:${blob.type || 'image/svg+xml'};base64,${bytesToBase64(bytes)}`;

    if (rawImageCache.size >= RAW_IMAGE_CACHE_MAX) {
      const oldest = rawImageCache.keys().next().value;
      if (oldest !== undefined) rawImageCache.delete(oldest);
    }
    rawImageCache.set(url, dataUri);
    finishDebugRequest(debugId, {
      status: resp.status,
      ok: true,
      responseBody: {
        contentType: blob.type || 'image/svg+xml',
        bytes: bytes.length,
        dataUriChars: dataUri.length,
      },
    });
    return { dataUri };
  } catch (error) {
    logger.error('fetchRawImage error', error);
    finishDebugRequest(debugId, {
      ok: false,
      error: (error as Error)?.message || 'raw image fetch failed',
    });
    return { error: (error as Error)?.message || 'raw image fetch failed' };
  }
}
