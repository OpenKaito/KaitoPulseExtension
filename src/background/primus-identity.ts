let initialization: Promise<void> | undefined;

async function hasIdentity(): Promise<boolean> {
  const { userInfo } = await chrome.storage.local.get('userInfo');
  if (typeof userInfo !== 'string') return false;
  try {
    const value = JSON.parse(userInfo);
    return Boolean(value?.id && typeof value?.token === 'string' && value.token);
  } catch {
    return false;
  }
}

export function ensurePrimusIdentity(): Promise<void> {
  initialization ??= (async () => {
    if (await hasIdentity()) return;
    const initialize = (
      globalThis as typeof globalThis & {
        __kaitoInitializePrimusIdentity?: () => Promise<void>;
      }
    ).__kaitoInitializePrimusIdentity;
    if (!initialize) throw new Error('primus_identity_initialization_failed');
    await chrome.storage.local.remove('userInfo');
    await initialize();
    if (!(await hasIdentity())) throw new Error('primus_identity_initialization_failed');
  })()
    .catch(() => {
      throw new Error('primus_identity_initialization_failed');
    })
    .finally(() => {
      initialization = undefined;
    });
  return initialization;
}
