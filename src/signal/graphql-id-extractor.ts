
export const TID_MAP_MESSAGE = 'kaito-tid-map' as const;

export interface TidPair {

  handle: string;

  id: string;
}

export interface TidMapMessage {
  source: typeof TID_MAP_MESSAGE;
  pairs: TidPair[];
}

const MAX_NODES = 50_000;
const ID_RE = /^\d{1,32}$/;
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

function readId(obj: Record<string, unknown>): string | null {
  const restId = obj.rest_id;
  if (typeof restId === 'string' && ID_RE.test(restId)) return restId;
  if (typeof restId === 'number' && Number.isInteger(restId) && restId > 0) return String(restId);
  const idStr = obj.id_str;
  if (typeof idStr === 'string' && ID_RE.test(idStr)) return idStr;
  return null;
}

function pickScreenName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const sn = (value as Record<string, unknown>).screen_name;
  return typeof sn === 'string' && HANDLE_RE.test(sn) ? sn.toLowerCase() : null;
}

function readScreenName(obj: Record<string, unknown>): string | null {

  return pickScreenName(obj) ?? pickScreenName(obj.legacy) ?? pickScreenName(obj.core);
}

export function extractTidPairs(root: unknown): TidPair[] {
  const found = new Map<string, string>();
  const stack: unknown[] = [root];
  let budget = MAX_NODES;

  while (stack.length > 0) {
    if (budget-- <= 0) break;
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }

    const obj = node as Record<string, unknown>;
    const id = readId(obj);
    if (id) {
      const handle = readScreenName(obj);
      if (handle) found.set(handle, id);
    }
    for (const key in obj) stack.push(obj[key]);
  }

  return Array.from(found, ([handle, id]) => ({ handle, id }));
}
