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
    if (!initialize) throw new Error('primus_identity_initialization_failed: no_initializer');
    await chrome.storage.local.remove('userInfo');
    try {
      await initialize();
    } catch (error) {
      throw new Error(
        `primus_identity_initialization_failed: threw ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          300,
        ),
      );
    }
    if (!(await hasIdentity()))
      throw new Error('primus_identity_initialization_failed: no_identity');
  })()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        message.startsWith('primus_identity_initialization_failed')
          ? message
          : `primus_identity_initialization_failed: ${message}`.slice(0, 300),
      );
    })
    .finally(() => {
      initialization = undefined;
    });
  return initialization;
}
