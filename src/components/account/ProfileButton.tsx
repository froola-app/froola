import { useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from './Avatar';
import ProfileSidebar, { type PlayActions } from './ProfileSidebar';

// The round avatar in the top-right corner of the play screen. Unlike the
// old AuthButton it renders in every auth state — signed out (and even
// before Supabase is configured) it still opens the sidebar, which is
// where settings and the Google sign-in live.
//
// `variant="nav"` is for mounting it inline in a page nav (e.g. the landing
// page) instead of as a fixed HUD overlay: the default styling is sized and
// colored for the dark play-screen canvas, and disappears against a light
// nav bar otherwise.
export default function ProfileButton({ play, variant }: { play?: PlayActions; variant?: 'nav' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        className={variant === 'nav' ? 'profile-btn profile-btn--nav' : 'profile-btn'}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={user ? 'Account and settings' : 'Sign in and settings'}
      >
        <Avatar size={30} />
      </button>
      <ProfileSidebar
        open={open}
        play={play}
        onClose={() => {
          setOpen(false);
          btnRef.current?.focus();
        }}
      />
    </>
  );
}
