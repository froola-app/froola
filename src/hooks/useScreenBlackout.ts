import { useEffect, useState } from 'react';

const PRINT_SCREEN_CLEAR_MS = 1500;

/* Best-effort deterrent, not real protection: no web API can see OS-level
   screen recording or macOS's Cmd+Shift+3/4/5 (a global system hotkey that
   never reaches the browser). This only catches focus/visibility loss
   (alt-tab, minimizing, switching to a recorder's UI) and Windows
   PrintScreen, which the browser does receive as a keydown. */
export function useScreenBlackout(active: boolean): boolean {
  const [blacked, setBlacked] = useState(false);

  useEffect(() => {
    if (!active) {
      setBlacked(false);
      return;
    }

    const syncFromFocusState = () => {
      setBlacked(document.hidden || !document.hasFocus());
    };

    let printScreenTimer: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PrintScreen') return;
      setBlacked(true);
      clearTimeout(printScreenTimer);
      printScreenTimer = setTimeout(syncFromFocusState, PRINT_SCREEN_CLEAR_MS);
    };

    syncFromFocusState();
    window.addEventListener('blur', syncFromFocusState);
    window.addEventListener('focus', syncFromFocusState);
    document.addEventListener('visibilitychange', syncFromFocusState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(printScreenTimer);
      window.removeEventListener('blur', syncFromFocusState);
      window.removeEventListener('focus', syncFromFocusState);
      document.removeEventListener('visibilitychange', syncFromFocusState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  return blacked;
}
