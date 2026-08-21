
const PORT_NAME = 'kaitoExtension';

export type KaitoPortOptions = {

  disconnectMessage: string;

  disconnectAfterResponse: boolean;
};

export function sendOverKaitoPort<TReply>(
  message: unknown,
  { disconnectMessage, disconnectAfterResponse }: KaitoPortOptions,
): Promise<TReply> {
  return new Promise<TReply>((resolve, reject) => {
    let port: chrome.runtime.Port;
    let settled = false;

    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    port.onMessage.addListener((response) => {
      if (settled) return;
      settled = true;
      resolve(response as TReply);
      if (disconnectAfterResponse) port.disconnect();
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      settled = true;
      reject(new Error(chrome.runtime.lastError?.message || disconnectMessage));
    });

    try {
      port.postMessage(message);
    } catch (error) {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
