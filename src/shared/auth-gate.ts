import type { AuthIntentRequest, ReplyFor } from '@/shared/messages';
import { sendOverKaitoPort } from '@/shared/port-rpc';
import type { PendingAuthIntent } from '@/shared/storage';

const AUTH_CONTEXT_ID = ((): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `ctx-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
})();

type WithoutContextId<T> = T extends unknown ? Omit<T, 'contextId'> : never;

function sendAuthIntentRequest<R extends WithoutContextId<AuthIntentRequest>>(
  request: R,
): Promise<ReplyFor<R['action']>> {
  return sendOverKaitoPort<ReplyFor<R['action']>>(

    { ...request, contextId: AUTH_CONTEXT_ID },
    {
      disconnectMessage: 'auth intent broker disconnected',
      disconnectAfterResponse: true,
    },
  );
}

export async function recordAuthIntent(
  intent: Omit<PendingAuthIntent, 'createdAt'>,
): Promise<void> {
  const response = await sendAuthIntentRequest({
    target: 'kaitoExtension',
    action: 'recordAuthIntent',
    intent,
  });
  if (response.ok !== true) throw new Error(response.error);
}

export async function takeAuthIntent(
  kind: PendingAuthIntent['kind'],
): Promise<PendingAuthIntent | null> {
  const response = await sendAuthIntentRequest({
    target: 'kaitoExtension',
    action: 'takeAuthIntent',
    kind,
  });
  if (response.ok !== true) throw new Error(response.error);
  return response.intent;
}

export async function cancelAuthIntent(kind: PendingAuthIntent['kind']): Promise<void> {
  const response = await sendAuthIntentRequest({
    target: 'kaitoExtension',
    action: 'cancelAuthIntent',
    kind,
  });
  if (response.ok !== true) throw new Error(response.error);
}
