import { render } from 'solid-js/web';
import { App } from './App';
import { ensurePopupFonts } from '@/popup/load-fonts';

console.log('[TIMING] popup main.tsx start', performance.now());

void ensurePopupFonts().then(() => {
  try {
    const mount = document.getElementById('app');
    if (!mount) throw new Error('popup: #app mount node not found');
    render(() => <App />, mount);
  } catch (error) {
    throw error;
  }
});
