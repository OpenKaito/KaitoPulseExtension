import type {
  AuthIntentRequest,
  CancelAuthIntentResponse,
  RecordAuthIntentResponse,
  TakeAuthIntentResponse,
} from '@/shared/messages';
import {
  pendingAuthIntentsItem,
  type PendingAuthIntent,
  type PendingAuthIntentKind,
  type PendingAuthIntentMap,
  type StoredPendingAuthIntent,
} from '@/shared/storage';

const INTENT_TTL_MS = 15 * 60 * 1000;

type AuthIntentResponse =
  | RecordAuthIntentResponse
  | TakeAuthIntentResponse
  | CancelAuthIntentResponse;

let operationChain: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationChain.then(operation);
  operationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function publicIntent(intent: StoredPendingAuthIntent): PendingAuthIntent {
  return {
    kind: intent.kind,
    params: intent.params,
    createdAt: intent.createdAt,
  };
}

function withoutExpired(map: PendingAuthIntentMap, now: number): PendingAuthIntentMap {
  const next: PendingAuthIntentMap = {};
  for (const [kind, intent] of Object.entries(map) as [PendingAuthIntentKind, StoredPendingAuthIntent][]) {
    if (intent && now - intent.createdAt <= INTENT_TTL_MS) next[kind] = intent;
  }
  return next;
}

function isOwnedBy(
  intent: StoredPendingAuthIntent | undefined,
  senderTabId: number | undefined,
  contextId: string,
): intent is StoredPendingAuthIntent {
  return (
    intent !== undefined &&
    typeof senderTabId === 'number' &&
    intent.ownerTabId === senderTabId &&
    intent.ownerContextId === contextId
  );
}

async function record(
  intent: Omit<PendingAuthIntent, 'createdAt'>,
  senderTabId: number | undefined,
  contextId: string,
): Promise<RecordAuthIntentResponse> {
  if (typeof senderTabId !== 'number') {
    throw new Error('auth_intent_sender_tab_required');
  }
  const now = Date.now();
  const map = withoutExpired(await pendingAuthIntentsItem.getValue(), now);

  map[intent.kind] = {
    ...intent,
    createdAt: now,
    ownerTabId: senderTabId,
    ownerContextId: contextId,
  };
  await pendingAuthIntentsItem.setValue(map);
  return { ok: true };
}

async function take(
  kind: PendingAuthIntentKind,
  senderTabId: number | undefined,
  contextId: string,
): Promise<TakeAuthIntentResponse> {
  const map = withoutExpired(await pendingAuthIntentsItem.getValue(), Date.now());
  const intent = map[kind];
  if (!isOwnedBy(intent, senderTabId, contextId)) {

    await pendingAuthIntentsItem.setValue(map);
    return { ok: true, intent: null };
  }
  delete map[kind];
  await pendingAuthIntentsItem.setValue(map);
  return { ok: true, intent: publicIntent(intent) };
}

async function cancel(
  kind: PendingAuthIntentKind,
  senderTabId: number | undefined,
  contextId: string,
): Promise<CancelAuthIntentResponse> {
  const map = withoutExpired(await pendingAuthIntentsItem.getValue(), Date.now());
  const owned = isOwnedBy(map[kind], senderTabId, contextId);
  if (owned) delete map[kind];
  await pendingAuthIntentsItem.setValue(map);
  return { ok: true, canceled: owned };
}

export function handleAuthIntentRequest(
  request: AuthIntentRequest,
  senderTabId: number | undefined,
): Promise<AuthIntentResponse> {
  return serialize(() => {
    switch (request.action) {
      case 'recordAuthIntent':
        return record(request.intent, senderTabId, request.contextId);
      case 'takeAuthIntent':
        return take(request.kind, senderTabId, request.contextId);
      case 'cancelAuthIntent':
        return cancel(request.kind, senderTabId, request.contextId);
    }
  });
}
