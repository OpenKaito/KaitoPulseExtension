
import interWoff2 from 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2?remote-inline';

function dataUriToArrayBuffer(uri: string): ArrayBuffer {
  const base64 = uri.slice(uri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let ready: Promise<void> | null = null;

export function ensurePopupFonts(): Promise<void> {
  ready ??= (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    try {
      const face = new FontFace('Inter', dataUriToArrayBuffer(interWoff2), { style: 'normal', weight: '100 900' });
      await face.load();
      document.fonts.add(face);
    } catch {

    }
  })();
  return ready;
}
