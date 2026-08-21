import { logDev } from '@/lib/env';
import { logLocalError } from '@/lib/guard';
import { toMatchPatterns } from '@/shared/connect-origins';

export async function injectConnectTabsAfterInstall(): Promise<void> {
  const matches = toMatchPatterns(import.meta.env.VITE_KAITO_CONNECT_URL as string | undefined);
  if (matches.length === 0) return;

  const connectPatterns = new Set(matches);
  const files = (chrome.runtime.getManifest().content_scripts ?? [])
    .filter((entry) => (entry.matches ?? []).some((pattern) => connectPatterns.has(pattern)))
    .flatMap((entry) => entry.js ?? []);
  if (files.length === 0) return;

  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: matches });
  } catch (error) {
    logLocalError(error, 'injectConnectTabs.query');
    return;
  }

  const results = await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return false;
      try {

        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
        return true;
      } catch (error) {

        logDev('inject failed for tab', tab.id, error);
        return false;
      }
    }),
  );

  const injected = results.filter(Boolean).length;
  logDev(`injected the Kaito content script into ${injected}/${tabs.length} already-open tab(s)`);
}
