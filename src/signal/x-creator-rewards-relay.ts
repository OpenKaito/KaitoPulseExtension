import { createLogger } from './logger';
import { deriveViewerId } from './viewer-identity';
import {
  READ_X_CREATOR_REWARDS_MESSAGE,
  readCookieValue,
  readXCreatorRewardsPage,
} from './x-creator-rewards';

const logger = createLogger('x-creator-rewards');

export class XCreatorRewardsRelay {
  private listening = false;

  private readonly onRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean | undefined => {
    if ((message as { type?: unknown } | null)?.type !== READ_X_CREATOR_REWARDS_MESSAGE)
      return undefined;

    readXCreatorRewardsPage(deriveViewerId(document), readCookieValue(document.cookie, 'ct0')).then(
      sendResponse,
      (error) => {
        logger.error('read x creator rewards page threw', error);
        sendResponse({ ok: false, error: 'unavailable' });
      },
    );
    return true;
  };

  start(): void {
    if (this.listening) return;
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
    this.listening = false;
  }
}
