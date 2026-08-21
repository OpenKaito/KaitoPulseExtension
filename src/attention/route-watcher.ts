
const INSTALL_FLAG = '__kaitoAttnRouteWatcherInstalled';
const CHANGE_EVENT = 'kaito-attn:locationchange';
const POLL_INTERVAL_MS = 500;

function ensurePatched(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[INSTALL_FLAG]) return;
  w[INSTALL_FLAG] = true;

  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name].bind(history);
    history[name] = function patched(...args: Parameters<History['pushState']>) {
      const result = original(...args);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return result;
    } as History['pushState'];
  }
}

export function startRouteWatcher(onRouteChange: (url: string) => void): () => void {
  ensurePatched();
  const listener = (): void => onRouteChange(location.href);
  window.addEventListener('popstate', listener);
  window.addEventListener(CHANGE_EVENT, listener);

  let lastHref = location.href;
  const pollTimer = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onRouteChange(location.href);
    }
  }, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(CHANGE_EVENT, listener);
    clearInterval(pollTimer);
  };
}
