import { api } from '@/lib/api';
import type { XCreatorRewardsSubmitResult } from '@/shared/x-creator-rewards';
import { createLogger } from '@/signal/logger';
import {
  READ_X_CREATOR_REWARDS_MESSAGE,
  type XCreatorRewardsReadResult,
} from '@/signal/x-creator-rewards';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('x-creator-rewards');

export type XCreatorRewardsConsoleResult =
  | { ok: true; tabId: number; twitterId: string; result: XCreatorRewardsSubmitResult }
  | { ok: false; step: 'tab' | 'read' | 'submit'; error: string; status?: number };

async function findXTabs(): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*'] });
  return [...tabs.filter((tab) => tab.active), ...tabs.filter((tab) => !tab.active)];
}

function readPageInTab(tabId: number): Promise<XCreatorRewardsReadResult> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: READ_X_CREATOR_REWARDS_MESSAGE }, (reply) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(reply as XCreatorRewardsReadResult);
    });
  });
}

export async function reportXCreatorRewardsFromConsole(): Promise<XCreatorRewardsConsoleResult> {
  const tabs = await findXTabs();
  if (tabs.length === 0) {
    return { ok: false, step: 'tab', error: 'open https://x.com in a tab first' };
  }

  let read: XCreatorRewardsReadResult | undefined;
  let tabId: number | undefined;
  let lastError = '';
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      read = await readPageInTab(tab.id);
      tabId = tab.id;
      break;
    } catch (error) {
      lastError = (error as Error).message;
    }
  }
  if (!read || tabId === undefined) {
    return {
      ok: false,
      step: 'tab',
      error: `reload an x.com tab and retry (${lastError})`,
    };
  }
  if (!read.ok) {
    return {
      ok: false,
      step: 'read',
      error: read.error,
      ...(read.status ? { status: read.status } : {}),
    };
  }

  try {
    const result = await authedCall((token) => api.submitXCreatorRewardsSnapshot(token, read.page));
    return { ok: true, tabId, twitterId: read.page.twitterId, result };
  } catch (error) {
    logger.error('submitXCreatorRewardsSnapshot error', error);
    return {
      ok: false,
      step: 'submit',
      ...toAuthedError(error, 'x creator rewards submit failed'),
    };
  }
}
