const EXTENSION_ONLY_ACTIONS = new Set([
  'exportLastAttestation',
  'getDebugRequests',
  'clearDebugRequests',
  'getBehaviorEvents',
  'clearBehaviorEvents',
  'resetSession',
]);

export function isTrustedExtensionSender(
  sender: chrome.runtime.MessageSender | undefined,
  extensionId: string,
): boolean {
  if (sender?.id !== extensionId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.host === extensionId;
  } catch {
    return false;
  }
}

export function canAccessMessage(
  action: string,
  sender: chrome.runtime.MessageSender | undefined,
  extensionId: string,
): boolean {
  if (sender?.id !== extensionId) return false;
  return !EXTENSION_ONLY_ACTIONS.has(action) || isTrustedExtensionSender(sender, extensionId);
}
