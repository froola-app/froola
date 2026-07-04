// A cancelled or failed OAuth sign-in doesn't come back through /auth/popup —
// Supabase redirects the error to the project's Site URL (our app root) with
// `?error=access_denied&error_description=...` (PKCE) or `#error=...`
// (implicit). That leaves the sign-in popup sitting on the landing page with a
// noisy URL instead of closing.
//
// Run this once before React mounts: if such an error is present, close the
// popup (a cancel means no session, so there's nothing to hand back to the
// opener) and strip the params so the app never renders with them.
export function cleanupOAuthError(): void {
  const { search, hash, pathname } = window.location;
  const hasError = /[?&]error=/.test(search) || /[#&]error=/.test(hash);
  if (!hasError) return;

  // Opened by the app as the sign-in popup — just close it. close() is a
  // no-op when the window wasn't script-opened (a popup blocker forced the
  // flow into a full tab), so the scrub below still cleans that case up.
  if (window.opener && window.opener !== window) {
    window.close();
  }

  window.history.replaceState(null, '', pathname);
}
