import { createClient, type User } from '@supabase/supabase-js';

// Server-only service-role client — bypasses RLS, so this file must never
// be imported from src/ (browser bundle). Reuses VITE_SUPABASE_URL because
// the project URL isn't secret (only the anon vs. service-role *key*
// matters); Vercel exposes all configured env vars to functions regardless
// of the VITE_ prefix, which only controls client-bundle inlining.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

// Validates the Supabase access token a client sends in the Authorization
// header, so checkout/portal sessions are always created for the caller's
// own account, not a client_reference_id an attacker could forge.
export async function getUserFromAuthHeader(authHeader: string | undefined | null): Promise<User | null> {
  if (!supabaseAdmin || !authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
