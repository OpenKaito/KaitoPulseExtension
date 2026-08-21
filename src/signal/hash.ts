
export function stableHash(value: unknown): string {
  const stableString = stableStringify(value);
  return fnv1a(stableString);
}

export function stableStringify(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
  if (t === 'string') return JSON.stringify(value);
  if (t === 'symbol') return `Symbol(${(value as symbol).description || ''})`;
  if (t === 'function') return `Function(${(value as any).name || 'anon'})`;
  if (t !== 'object') return `"${String(value)}"`;

  const obj = value as any;
  if (seen.has(obj)) return '"[Circular]"';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return '[' + obj.map(v => stableStringify(v, seen)).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k], seen)}`);
  return '{' + entries.join(',') + '}';
}

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);

    hash = (hash >>> 0) * 0x01000193;
  }

  return hash.toString(36);
}
