import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// One place for the avatar fallback chain: custom photo (profiles table,
// future upload flow) → Google account photo → initials → silhouette.
// Both the HUD profile button and the drawer header render this.

// Lives next to the component because it's the other half of the fallback
// chain; losing fast-refresh state over a helper export is fine (same
// call as AuthContext's useAuth).
// eslint-disable-next-line react-refresh/only-export-components
export function initialsOf(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  const initials = (first + last).toUpperCase();
  return initials || null;
}

function SilhouetteIcon() {
  return (
    <svg className="avatar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.2" r="4" />
      <path d="M4 20.4c0-3.7 3.6-6.2 8-6.2s8 2.5 8 6.2V21H4v-.6Z" />
    </svg>
  );
}

export default function Avatar({ size }: { size: number }) {
  const { user, profile } = useAuth();
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null;

  // A photo URL can 404/403 (Google avatar URLs expire, and some send
  // no referrer header back) — drop to initials instead of a broken img.
  // Remembering the URL that failed (rather than a boolean) means a new
  // URL naturally gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const initials = initialsOf(user?.displayName ?? null);

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {avatarUrl && avatarUrl !== failedUrl ? (
        <img
          className="avatar__img"
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : initials ? (
        <span className="avatar__initials">{initials}</span>
      ) : (
        <SilhouetteIcon />
      )}
    </span>
  );
}
