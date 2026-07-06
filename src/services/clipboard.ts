import * as Clipboard from 'expo-clipboard';

// Copied secrets must not sit on the OS clipboard indefinitely — on Android
// any app can read it. After a delay the clipboard is cleared, but only if it
// still holds the value we put there, so a newer user copy is never destroyed.
export const CLIPBOARD_CLEAR_SECONDS = 30;

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopied: string | null = null;

export const copySensitive = async (value: string): Promise<void> => {
  await Clipboard.setStringAsync(value);
  lastCopied = value;

  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(async () => {
    clearTimer = null;
    const copied = lastCopied;
    lastCopied = null;
    try {
      if ((await Clipboard.getStringAsync()) === copied) {
        await Clipboard.setStringAsync('');
      }
    } catch {
      // Clearing is best-effort; never surface an error for it.
    }
  }, CLIPBOARD_CLEAR_SECONDS * 1000);
};
