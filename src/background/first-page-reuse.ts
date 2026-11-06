export function createFirstPageReuse<T>(ttlMs: number, now: () => number = Date.now) {
  let entry: { key: string; at: number; value: T } | undefined;
  return {
    async get(key: string, load: () => Promise<T>): Promise<T> {
      if (entry && entry.key === key && now() - entry.at < ttlMs) return entry.value;
      const value = await load();
      entry = { key, at: now(), value };
      return value;
    },
  };
}
