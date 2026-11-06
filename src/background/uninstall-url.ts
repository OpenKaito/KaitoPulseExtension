export type StoredUninstallToken = { privyId: string; token: string };

export interface UninstallUrlDeps {
  apiBaseUrl: string;
  read(): Promise<StoredUninstallToken | undefined>;
  write(value: StoredUninstallToken): Promise<void>;
  remove(): Promise<void>;
  issue(): Promise<{ token: string }>;
  setUrl(url: string): Promise<void>;
  log(message: string, error: unknown): void;
}

export function uninstallUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl}/api/v1/extension/uninstall?t=${encodeURIComponent(token)}`;
}

export function createUninstallUrlSync(deps: UninstallUrlDeps) {
  let applied: string | null | undefined;
  let queue: Promise<void> = Promise.resolve();

  const run = (task: () => Promise<void>): Promise<void> => {
    queue = queue.then(task).catch((error) => {
      applied = undefined;
      deps.log('uninstall url sync failed', error);
    });
    return queue;
  };

  return {
    sync(privyId: string | undefined): Promise<void> {
      return run(async () => {
        if (!privyId) {
          if (applied === null) return;
          await deps.remove();
          await deps.setUrl('');
          applied = null;
          return;
        }
        if (applied === privyId) return;
        const stored = await deps.read();
        let token = stored?.privyId === privyId ? stored.token : undefined;
        if (!token) {
          token = (await deps.issue()).token;
          await deps.write({ privyId, token });
        }
        await deps.setUrl(uninstallUrl(deps.apiBaseUrl, token));
        applied = privyId;
      });
    },
  };
}
