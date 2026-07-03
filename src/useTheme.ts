import { useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'froola-theme';

export function storedTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

// Manual toggle only — deliberately ignores prefers-color-scheme so the
// site's theme is a user choice, not inherited from the OS.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useLayoutEffect(() => {
    localStorage.setItem(KEY, theme);
    // .lp4 is both position:fixed and its own scroll container, and
    // Chromium sometimes leaves that composited layer's background
    // stale after a CSS-variable-only repaint until something forces
    // a layout pass (e.g. scrolling). Force one synchronously before
    // paint so the toggle takes visible effect immediately.
    void document.body.offsetHeight;
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  return { theme, toggleTheme };
}
