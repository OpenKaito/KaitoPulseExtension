// Both functions are injected with chrome.scripting.executeScript, so each must stay self-contained.

export function holdScreenWakeLockInPage(): void {
  interface Sentinel {
    released: boolean;
    release(): Promise<void>;
  }
  const scope = globalThis as typeof globalThis & { __kaitoProofWakeLockRelease?: () => void };
  if (scope.__kaitoProofWakeLockRelease) return;
  const wakeLock = (
    globalThis.navigator as
      | { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }
      | undefined
  )?.wakeLock;
  const doc = globalThis.document;
  if (!wakeLock || !doc) return;

  let sentinel: Sentinel | null = null;
  let pending = false;
  let stopped = false;

  const acquire = async (): Promise<void> => {
    if (stopped || pending || doc.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    pending = true;
    try {
      const next = await wakeLock.request('screen');
      if (stopped) void next.release().catch(() => {});
      else sentinel = next;
    } catch {
    } finally {
      pending = false;
    }
  };
  const onVisibility = (): void => {
    void acquire();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  scope.__kaitoProofWakeLockRelease = () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', onVisibility);
    const held = sentinel;
    sentinel = null;
    if (held && !held.released) void held.release().catch(() => {});
  };
  void acquire();
}

export function releaseScreenWakeLockInPage(): void {
  const scope = globalThis as typeof globalThis & { __kaitoProofWakeLockRelease?: () => void };
  const release = scope.__kaitoProofWakeLockRelease;
  delete scope.__kaitoProofWakeLockRelease;
  release?.();
}
