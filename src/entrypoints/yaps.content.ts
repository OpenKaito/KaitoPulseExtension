import { YapsVerifySurface } from '@/verify/xpanel';
import { toMatchPatterns } from '@/shared/connect-origins';
import { guard, logLocalError } from '@/lib/guard';

export default defineContentScript({

  matches: toMatchPatterns(import.meta.env.VITE_KAITO_CONNECT_URL as string | undefined),
  runAt: 'document_idle',
  main() {
    let surface: YapsVerifySurface | null = null;

    const start = guard(() => {
      if (surface) return;
      try {
        surface = new YapsVerifySurface(document);
        surface.start();
      } catch (error) {
        surface = null;
        logLocalError(error, 'yaps.mount');
      }
    }, 'yaps.start');

    const stop = guard(() => {
      surface?.stop();
      surface = null;
    }, 'yaps.stop');

    start();
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', start);
  },
});
