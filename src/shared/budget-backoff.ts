const DEFAULT_PAUSE_MS = 60_000;
const DAY_WINDOW_PAUSE_MS = 60 * 60_000;

export function budgetPausedUntil(error: unknown, now: number): number | undefined {
  if (!error || typeof error !== 'object' || (error as { status?: unknown }).status !== 429) {
    return undefined;
  }
  const body = (error as { body?: unknown }).body;
  const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (fields.window === 'day') {
    return now + DAY_WINDOW_PAUSE_MS;
  }
  const seconds = Number(fields.retry_after_seconds);
  return now + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_PAUSE_MS);
}
