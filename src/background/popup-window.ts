export interface PopupSize {
  width: number;
  height: number;
}

export const KAITO_POPUP_SIZE: PopupSize = { width: 420, height: 720 };

const POPUP_MARGIN = 24;

export async function openPinnedPopupWindow(
  url: string,
  size: PopupSize = KAITO_POPUP_SIZE,
): Promise<chrome.windows.Window | undefined> {
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined);
  const create: chrome.windows.CreateData = {
    url,
    type: 'popup',
    width: size.width,
    height: size.height,
    focused: true,
  };
  if (win && typeof win.left === 'number' && typeof win.top === 'number' && typeof win.width === 'number') {
    create.left = Math.max(0, win.left + win.width - size.width - POPUP_MARGIN);
    create.top = win.top + POPUP_MARGIN;
  }
  return chrome.windows.create(create);
}

const VERIFY_RETURN_KEY = 'kaito.verifyReturn';

interface VerifyReturnTarget {

  windowId?: number;

  tabId: number;
}

export async function openVerifyWindow(verifierId: string, originTabId?: number): Promise<void> {
  const url = chrome.runtime.getURL(`verify-window.html?verifierId=${encodeURIComponent(verifierId)}`);
  const created = await openPinnedPopupWindow(url);

  if (typeof originTabId !== 'number') {
    await chrome.storage.session?.remove(VERIFY_RETURN_KEY).catch(() => undefined);
    return;
  }
  await chrome.storage.session
    ?.set({ [VERIFY_RETURN_KEY]: { windowId: created?.id, tabId: originTabId } satisfies VerifyReturnTarget })
    .catch(() => undefined);
}

export async function returnToOriginTabAfterVerify(closingWindowId?: number): Promise<void> {
  const stored = await chrome.storage.session?.get(VERIFY_RETURN_KEY).catch(() => undefined);
  const target = stored?.[VERIFY_RETURN_KEY] as VerifyReturnTarget | undefined;
  await chrome.storage.session?.remove(VERIFY_RETURN_KEY).catch(() => undefined);
  if (typeof target?.tabId !== 'number') return;
  if (
    typeof closingWindowId === 'number' &&
    typeof target.windowId === 'number' &&
    closingWindowId !== target.windowId
  ) {
    return;
  }
  const tab = await chrome.tabs.get(target.tabId).catch(() => undefined);
  if (!tab) return;
  await chrome.tabs.update(target.tabId, { active: true }).catch(() => undefined);
  if (tab.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
}

export async function openPopupWindow(): Promise<void> {
  await openPinnedPopupWindow(chrome.runtime.getURL('popup.html'));
}

export async function openToolbarPopup(): Promise<boolean> {
  if (typeof chrome.action.openPopup !== 'function') return false;
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined);
  if (typeof win?.id !== 'number') return false;

  if (!win.focused) {
    await chrome.windows.update(win.id, { focused: true }).catch(() => undefined);
  }
  return chrome.action
    .openPopup({ windowId: win.id })
    .then(() => true)
    .catch(() => false);
}
