import { render } from 'solid-js/web';
import { createShadowHost } from './shadow-host';

export type CompletionToastKind = 'success' | 'error';

const TOAST_MS = 4_000;
const toastCss = `
:host { all: initial; }
.kaito-completion-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483200;
  box-sizing: border-box;
  max-width: min(360px, calc(100vw - 40px));
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
  background: #191c1f;
  color: #fff;
  font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: kaito-toast-in 160ms ease-out;
}
.kaito-completion-toast--success { border-left: 3px solid #32ffdc; }
.kaito-completion-toast--error { border-left: 3px solid #f4212e; }
@keyframes kaito-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export function showCompletionToast(kind: CompletionToastKind, message: string): void {
  const { host, shadow } = createShadowHost(toastCss, 'kaito-completion-toast-host');
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;';
  const dispose = render(
    () => (
      <div
        class={`kaito-completion-toast kaito-completion-toast--${kind}`}
        role={kind === 'error' ? 'alert' : 'status'}
        aria-live={kind === 'error' ? 'assertive' : 'polite'}
      >
        {message}
      </div>
    ),
    shadow,
  );
  document.body.appendChild(host);
  window.setTimeout(() => {
    dispose();
    host.remove();
  }, TOAST_MS);
}
