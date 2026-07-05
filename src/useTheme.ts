import { useEffect, useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'froola-theme';
// Broadcast channel so every mounted useTheme() instance repaints when any
// one of them toggles (e.g. the sidebar's toggle updating the page behind it).
const EVENT = 'froola-theme-change';

export function storedTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

// The play screen's HUD and dials read the theme from <html data-theme>,
// which may render before any component calls useTheme() — stamp it eagerly
// at module load so the first paint is already themed.
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = storedTheme();
}

// Manual toggle only — deliberately ignores prefers-color-scheme so the
// site's theme is a user choice, not inherited from the OS.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useLayoutEffect(() => {
    localStorage.setItem(KEY, theme);
    // Root attribute drives the play HUD glass variables and the canvas
    // dial palette (read per-frame in the renderer).
    document.documentElement.dataset.theme = theme;
    // .lp4 is both position:fixed and its own scroll container, and
    // Chromium sometimes leaves that composited layer's background
    // stale after a CSS-variable-only repaint until something forces
    // a layout pass (e.g. scrolling). Force one synchronously before
    // paint so the toggle takes visible effect immediately.
    void document.body.offsetHeight;
  }, [theme]);

  useEffect(() => {
    const onChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const toggleTheme = () => {
    const next: Theme = storedTheme() === 'light' ? 'dark' : 'light';
    window.dispatchEvent(new CustomEvent<Theme>(EVENT, { detail: next }));
  };

  return { theme, toggleTheme };
}
