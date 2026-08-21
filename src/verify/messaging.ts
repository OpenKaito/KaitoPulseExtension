import type { ReplyFor, RuntimeRequest } from '@/shared/messages';
import { sendOverKaitoPort } from '@/shared/port-rpc';

type RuntimeRequestPayload<T> = T extends { target: 'kaitoExtension' } ? Omit<T, 'target'> : never;
export type VerifyRuntimeRequest = RuntimeRequestPayload<RuntimeRequest>;

export function sendVerifyMessage<R extends VerifyRuntimeRequest>(
  payload: R,
): Promise<ReplyFor<R['action']>> {
  return sendOverKaitoPort<ReplyFor<R['action']>>(
    { target: 'kaitoExtension', ...payload },
    {
      disconnectMessage: 'kaitoExtension port disconnected',
      disconnectAfterResponse: false,
    },
  );
}
