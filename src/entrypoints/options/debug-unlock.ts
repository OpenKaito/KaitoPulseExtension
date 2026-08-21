
import { debugUnlockedItem } from '@/shared/storage';

export async function loadDebugUnlocked(): Promise<boolean> {
  try {
    return (await debugUnlockedItem.getValue()) === true;
  } catch {
    return false;
  }
}

export async function setDebugUnlocked(unlocked: boolean): Promise<void> {
  await debugUnlockedItem.setValue(unlocked);
}

export function subscribeDebugUnlocked(cb: (unlocked: boolean) => void): () => void {
  return debugUnlockedItem.watch((unlocked) => cb(unlocked === true));
}

const KONAMI_SEQUENCE: readonly string[] = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

export function attachKonami(onMatch: () => void): () => void {
  const buffer: string[] = [];
  const handler = (event: KeyboardEvent): void => {
    buffer.push(event.code);
    if (buffer.length > KONAMI_SEQUENCE.length) buffer.shift();
    if (
      buffer.length === KONAMI_SEQUENCE.length &&
      KONAMI_SEQUENCE.every((code, i) => buffer[i] === code)
    ) {
      buffer.length = 0;
      onMatch();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
