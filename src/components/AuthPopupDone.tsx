import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabase';

// Rendered at /auth/popup — the OAuth redirect target for the sign-in
// popup opened by AuthContext.signInWithGoogle(). By the time this mounts,
// Supabase's client has already parsed the session from the URL hash
// (detectSessionInUrl, on by default). All we need to do is confirm the
// session exists, tell the opener window we're done, and close ourselves.
//
// If there's no window.opener, this wasn't reached via the popup flow (e.g.
// someone hit the URL directly) — just bounce to the landing page instead.
export default function AuthPopupDone() {
  const orphaned = !window.opener;

  useEffect(() => {
    if (orphaned) return;

    void supabase?.auth.getSession().then(() => {
      window.opener?.postMessage('froola:signed-in', window.location.origin);
      window.close();
    });
  }, [orphaned]);

  if (orphaned) return <Navigate to="/" replace />;
  return null;
}
