import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import FroolaLogo from './FroolaLogo';

// Where the Google OAuth popup lands after the provider redirect.
// supabase-js processes the tokens in the URL on init; once the session
// exists, ping the window that opened us (AuthContext listens for this)
// and close. Runs inside the popup window only.
export default function AuthPopup() {
  // A ref, not effect-local state: StrictMode re-runs the effect, and two
  // finish() calls would race two redirects below.
  const doneRef = useRef(false);
  useEffect(() => {
    if (!supabase) { window.close(); return; }
    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      window.opener?.postMessage('froola:signed-in', window.location.origin);
      window.close();
      // Browsers only let scripts close windows scripts opened. If a popup
      // blocker forced this flow into a full tab (or someone landed here
      // directly), close() is silently ignored — fall through into the app
      // instead of stranding them on this page.
      setTimeout(() => window.location.replace('/'), 400);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    // If the exchange never completes (revoked consent, clock skew…),
    // don't strand a frozen popup on the user's screen.
    const bail = setTimeout(finish, 8000);
    return () => { subscription.unsubscribe(); clearTimeout(bail); };
  }, []);

  return (
    <div className="auth-popup-page">
      <FroolaLogo size={48} color="#111111" />
      <p>Signing you in…</p>
    </div>
  );
}
