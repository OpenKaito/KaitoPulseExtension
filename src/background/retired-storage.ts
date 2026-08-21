
const RETIRED_LOCAL_KEYS: readonly string[] = [

  'kaitoChatGptHydrationDebug',
  'kaitoChatGptRequestDebug',
  'kaitoChatGptRequestTrace',
];

export async function sweepRetiredStorage(): Promise<void> {
  if (RETIRED_LOCAL_KEYS.length === 0) return;
  await chrome.storage.local.remove([...RETIRED_LOCAL_KEYS]).catch(() => undefined);
}
