import type { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

// A custom froola-branded toggle rather than a generic switch: the
// thumb is the same orange-accented circle as the wordmark's smile,
// and it slides between a sun (light) and moon (dark) icon.
export default function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={'theme-toggle' + (isDark ? ' is-dark' : '')}
      onClick={onToggle}
    >
      <span className="theme-toggle__track" aria-hidden="true" />
      <span className="theme-toggle__thumb" aria-hidden="true">
        <svg className="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.5 12H2.1M21.9 12h-2.4M6.3 6.3 4.6 4.6M19.4 19.4l-1.7-1.7M6.3 17.7l-1.7 1.7M19.4 4.6l-1.7 1.7" />
        </svg>
        <svg className="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      </span>
    </button>
  );
}
