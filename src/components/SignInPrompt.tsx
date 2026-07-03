import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const PROMPT_DELAY_MS = 120_000;
const SEEN_KEY = 'froola.signinPromptSeen';

// After a couple of minutes of playing, nudge anonymous users — once per
// tab session — to sign in so their lesson progress gets saved. Signing
// in (from anywhere) or dismissing kills it for the session.
export default function SignInPrompt() {
  const { user, firebaseReady, signInWithGoogle } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!firebaseReady || user) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) !== null; } catch { /* private mode */ }
    if (seen) return;
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
      setShow(true);
    }, PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [firebaseReady, user]);

  if (!show || user) return null;

  return (
    <div className="signin-prompt" role="dialog" aria-label="Sign in to save your progress">
      <p className="signin-prompt__title">Enjoying froola?</p>
      <p className="signin-prompt__body">
        Sign in to save your lesson progress across devices.
      </p>
      <div className="signin-prompt__actions">
        <button
          className="signin-prompt__google"
          onClick={() => { setShow(false); void signInWithGoogle(); }}
        >
          <img src="/google-logo.svg" alt="" width={16} height={16} />
          Continue with Google
        </button>
        <button className="signin-prompt__dismiss" onClick={() => setShow(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}
