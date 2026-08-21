import { attnFingerprintItem, deviceFingerprintItem, viewerItem } from '@/shared/storage';
import { stableHash } from '@/signal/hash';

async function getDeviceFingerprint(): Promise<string | undefined> {
  const fp = await attnFingerprintItem.getValue();
  if (!fp) return undefined;
  const hash = stableHash(fp);
  const stored = await deviceFingerprintItem.getValue();
  if (stored !== hash) await deviceFingerprintItem.setValue(hash);
  return hash;
}

export async function buildClientHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Req-Id': crypto.randomUUID(),
    'X-Req-Ts': String(Date.now()),
  };
  try { headers['X-Ext-Ver'] = chrome.runtime.getManifest().version; } catch {  }
  try { headers['X-Lang'] = chrome.i18n.getUILanguage(); } catch {  }
  try {
    const deviceFp = await getDeviceFingerprint();
    if (deviceFp) headers['X-Dev-Fp'] = deviceFp;
  } catch {  }
  try {
    const viewer = await viewerItem.getValue();
    if (viewer?.id) headers['X-Tw-Id'] = viewer.id;
    if (viewer?.handle) headers['X-Tw-Handle'] = viewer.handle;
  } catch {  }
  return headers;
}
