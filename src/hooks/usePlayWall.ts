import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const TIMER_MS = 120_000;
export const TRIGGERED_KEY = 'froola.playWallTriggered';

// Anonymous visitors get 2 minutes of actual play (once an input mode is
// chosen) before every future visit on this browser hard-gates behind a
// sign-up wall — persisted via localStorage, not sessionStorage, so it
// doesn't reset per tab.
export function usePlayWall(active: boolean): boolean {
  const { user, authReady, loading } = useAuth();
  const [triggered, setTriggered] = useState(() => {
    try { return localStorage.getItem(TRIGGERED_KEY) !== null; } catch { return false; }
  });

  useEffect(() => {
    if (!authReady || user || triggered || !active) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(TRIGGERED_KEY, '1'); } catch { /* private mode */ }
      setTriggered(true);
    }, TIMER_MS);
    return () => clearTimeout(timer);
  }, [authReady, user, active, triggered]);

  return !loading && authReady && !user && triggered;
}
