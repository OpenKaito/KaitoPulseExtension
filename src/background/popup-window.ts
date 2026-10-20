import { verifySurfaceKey, type VerifySurfaceRequest } from '../shared/verify-surface';

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
  const win = await chrome.windows
    .getLastFocused({ windowTypes: ['normal'] })
    .catch(() => undefined);
  const create: chrome.windows.CreateData = {
    url,
    type: 'popup',
    width: size.width,
    height: size.height,
    focused: true,
  };
  if (
    win &&
    typeof win.left === 'number' &&
    typeof win.top === 'number' &&
    typeof win.width === 'number'
  ) {
    create.left = Math.max(0, win.left + win.width - size.width - POPUP_MARGIN);
    create.top = win.top + POPUP_MARGIN;
  }
  return chrome.windows.create(create);
}

export async function openVerifyWindow(
  verifierId: string,
  originTabId?: number,
  originWindowId?: number,
): Promise<void> {
  const windowId =
    originWindowId ??
    (
      await chrome.windows.getLastFocused({
        windowTypes: ['normal'],
      })
    ).id;
  if (typeof windowId !== 'number') throw new Error('verification_window_unavailable');

  const request: VerifySurfaceRequest = {
    verifierId,
    originTabId,
    requestedAt: Date.now(),
  };
  const saved = chrome.storage.session.set({ [verifySurfaceKey(windowId)]: request });
  let opened: Promise<boolean>;
  try {
    opened = chrome.sidePanel.open({ windowId }).then(
      () => true,
      () => false,
    );
  } catch {
    opened = Promise.resolve(false);
  }
  const [, isOpen] = await Promise.all([saved, opened]);
  if (!isOpen) {
    const url = chrome.runtime.getURL(`verify-window.html?surface=popup&ownerWindowId=${windowId}`);
    const platform = await Promise.resolve(chrome.runtime.getPlatformInfo?.()).catch(
      () => undefined,
    );
    if (platform?.os === 'android') {
      await chrome.tabs.create({ url, active: true });
    } else {
      await openPinnedPopupWindow(url);
    }
  }
}

export async function returnToOriginTabAfterVerify(windowId?: number): Promise<void> {
  if (typeof windowId !== 'number') return;
  const key = verifySurfaceKey(windowId);
  const stored = await chrome.storage.session.get(key);
  const target = stored[key] as VerifySurfaceRequest | undefined;
  await chrome.storage.session.remove(key);
  if (typeof target?.originTabId !== 'number') return;
  const tab = await chrome.tabs.get(target.originTabId).catch(() => undefined);
  if (!tab) return;
  await chrome.tabs.update(target.originTabId, { active: true }).catch(() => undefined);
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
}

export async function openPopupWindow(): Promise<void> {
  await openPinnedPopupWindow(chrome.runtime.getURL('popup.html'));
}

export async function openToolbarPopup(): Promise<boolean> {
  if (typeof chrome.action.openPopup !== 'function') return false;
  const win = await chrome.windows
    .getLastFocused({ windowTypes: ['normal'] })
    .catch(() => undefined);
  if (typeof win?.id !== 'number') return false;

  if (!win.focused) {
    await chrome.windows.update(win.id, { focused: true }).catch(() => undefined);
  }
  return chrome.action
    .openPopup({ windowId: win.id })
    .then(() => true)
    .catch(() => false);
}
