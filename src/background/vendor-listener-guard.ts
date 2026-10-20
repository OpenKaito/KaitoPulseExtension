type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => unknown;

export function guardVendorMessageListeners(
  event: Pick<typeof chrome.runtime.onMessage, 'addListener' | 'removeListener' | 'hasListener'>,
  skip: (message: unknown) => boolean,
): void {
  const add = event.addListener.bind(event);
  const remove = event.removeListener.bind(event);
  const has = event.hasListener.bind(event);
  const wrapped = new Map<MessageListener, MessageListener>();

  event.addListener = ((listener: MessageListener) => {
    if (wrapped.has(listener)) return;
    const guarded: MessageListener = (message, sender, sendResponse) =>
      skip(message) ? false : listener(message, sender, sendResponse);
    wrapped.set(listener, guarded);
    add(guarded as Parameters<typeof add>[0]);
  }) as typeof event.addListener;

  event.removeListener = ((listener: MessageListener) => {
    const guarded = wrapped.get(listener);
    wrapped.delete(listener);
    remove((guarded ?? listener) as Parameters<typeof remove>[0]);
  }) as typeof event.removeListener;

  event.hasListener = ((listener: MessageListener) => {
    const guarded = wrapped.get(listener);
    return has((guarded ?? listener) as Parameters<typeof has>[0]);
  }) as typeof event.hasListener;
}
