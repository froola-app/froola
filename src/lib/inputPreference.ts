// Remembers the player's input choice (camera vs mouse/touch) for a short window
// so a page reload doesn't re-prompt them. Once they pick on the landing screen,
// the next loads within TTL_MS auto-start with that same choice.

export type RememberedInput = 'camera' | 'mouse';

const KEY = 'froola.inputChoice';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function rememberInput(mode: RememberedInput): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode, expires: Date.now() + TTL_MS }));
  } catch {
    /* localStorage unavailable (private mode, etc.) — the choice just won't persist */
  }
}

export function getRememberedInput(): RememberedInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { mode, expires } = JSON.parse(raw) as { mode?: RememberedInput; expires?: number };
    if (typeof expires !== 'number' || Date.now() > expires) {
      localStorage.removeItem(KEY);
      return null;
    }
    return mode === 'camera' || mode === 'mouse' ? mode : null;
  } catch {
    return null;
  }
}
