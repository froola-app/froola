import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Optional sign-in for the playing screen — nobody is gated upfront.
// Signed out: one button into the Google popup (play state survives).
// Signed in: first name, with sign-out tucked behind a click.
export default function AuthButton() {
  const { user, firebaseReady, signInWithGoogle, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);

  if (!firebaseReady) return null;

  if (!user) {
    return (
      <button
        className="auth-btn"
        onClick={() => { signInWithGoogle().catch(() => { /* popup blocked or closed */ }); }}
      >
        Sign in
      </button>
    );
  }

  const firstName = user.displayName?.split(' ')[0] || 'Account';
  return (
    <>
      <button className="auth-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {firstName}
      </button>
      {open && (
        <button
          className="auth-btn auth-btn--signout"
          onClick={() => { setOpen(false); void signOutUser(); }}
        >
          Sign out
        </button>
      )}
    </>
  );
}
