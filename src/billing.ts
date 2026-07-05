import { supabase } from './supabase';
import type { PlanId } from './pricingTiers.ts';

export type { PlanId };

async function authedFetch(path: string, body?: unknown): Promise<{ url: string } | { error: string }> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) return { error: 'not signed in' };

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Redirects the browser to Stripe Checkout for the given tier. Caller is
// responsible for making sure the user is signed in first — this returns
// silently (no redirect) if the caller isn't.
export async function startCheckout(plan: PlanId): Promise<void> {
  const result = await authedFetch('/api/create-checkout-session', { plan });
  if ('url' in result) window.location.href = result.url;
  else console.error('startCheckout failed', result.error);
}

// Redirects the browser to the Stripe Billing Portal for the signed-in
// user's existing subscription.
export async function openBillingPortal(): Promise<void> {
  const result = await authedFetch('/api/create-portal-session');
  if ('url' in result) window.location.href = result.url;
  else console.error('openBillingPortal failed', result.error);
}
