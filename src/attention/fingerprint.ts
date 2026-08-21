
import type { AttentionFingerprint } from '@/shared/attention';
import { stableHash } from '@/signal/hash';

function collectCanvasFingerprint(): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Kaito fp \u{1F6E1} 0123', 2, 2);
    ctx.fillStyle = 'rgba(102, 200, 0, 0.7)';
    ctx.fillText('Kaito fp \u{1F6E1} 0123', 4, 4);
    return stableHash(canvas.toDataURL());
  } catch {
    return null;
  }
}

function collectWebglFingerprint(): { vendor: string | null; renderer: string | null; hash: string | null } {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { vendor: null, renderer: null, hash: null };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : null;
    const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : null;
    const signature = [
      vendor,
      renderer,
      String(gl.getParameter(gl.VERSION)),
      String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
      String(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      (gl.getSupportedExtensions() ?? []).join(','),
    ].join('|');
    return { vendor, renderer, hash: stableHash(signature) };
  } catch {
    return { vendor: null, renderer: null, hash: null };
  }
}

async function collectAudioFingerprint(): Promise<string | null> {
  try {
    const AudioCtx = window.OfflineAudioContext;
    if (!AudioCtx) return null;
    const context = new AudioCtx(1, 5000, 44100);
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);
    const buffer = await context.startRendering();
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < data.length; i++) sum += Math.abs(data[i]);
    return stableHash(sum.toString());
  } catch {
    return null;
  }
}

export async function collectFingerprint(): Promise<AttentionFingerprint> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const canvasHash = collectCanvasFingerprint();
  const { vendor: webglVendor, renderer: webglRenderer, hash: webglHash } = collectWebglFingerprint();
  const audioHash = await collectAudioFingerprint();
  return {
    ua: nav.userAgent,
    platform: nav.platform,
    languages: Array.from(nav.languages ?? [nav.language]),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenW: window.screen?.width ?? 0,
    screenH: window.screen?.height ?? 0,
    colorDepth: window.screen?.colorDepth ?? 0,
    hardwareConcurrency: nav.hardwareConcurrency ?? 0,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    canvasHash,
    webglVendor,
    webglRenderer,
    webglHash,
    audioHash,
  };
}
