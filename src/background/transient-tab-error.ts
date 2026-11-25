const TRANSIENT_TAB_ERROR_FRAGMENTS = [
  'Frame with ID 0 was removed',
  'A frame with ID 0 was removed',
  'Cannot access contents of url',
  'Extension context invalidated',
  'The tab was closed',
  'No tab with id',
  'No window with id',
  'Tabs cannot be edited right now',
] as const;

export function isTransientTabError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_TAB_ERROR_FRAGMENTS.some((fragment) => message.includes(fragment));
}

export async function retryTransientTab<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 6;
  const delayMs = options.delayMs ?? 400;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientTabError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
