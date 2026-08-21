import type { ReplyFor, RuntimeRequest } from '@/shared/messages';
import { sendOverKaitoPort } from '@/shared/port-rpc';
import { imgBucket, isDirectFetchHost, isXcomRenderableHost } from './image-proxy';

export async function sendKaitoMessage<R extends RuntimeRequest>(
  request: R,
): Promise<ReplyFor<R['action']>> {
  return sendOverKaitoPort<ReplyFor<R['action']>>(request, {
    disconnectMessage: 'kaito worker port disconnected before responding',
    disconnectAfterResponse: true,
  });
}

export async function resolveImageSrc(src: string, cssPx: number): Promise<string> {
  if (isXcomRenderableHost(src)) return src;
  if (isDirectFetchHost(src)) {
    const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'fetchRawImage', url: src });
    if (response.error || !response.dataUri) {
      throw new Error(response.error || 'raw image fetch returned no data');
    }
    return response.dataUri;
  }
  const response = await sendKaitoMessage({
    target: 'kaitoExtension',
    action: 'fetchImage',
    url: src,
    width: imgBucket(cssPx),
  });
  if (response.error || !response.dataUri) {
    throw new Error(response.error || 'image proxy returned no data');
  }
  return response.dataUri;
}
