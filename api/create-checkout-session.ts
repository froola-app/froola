import { stripe, priceIdForPlan, type PlanId } from './_lib/stripe.js';
import { getUserFromAuthHeader, supabaseAdmin } from './_lib/supabaseAdmin.js';
import { originFrom, type ApiRequest, type ApiResponse } from './_lib/http.js';

function isPlanId(value: unknown): value is PlanId {
  return value === 'plus' || value === 'studio';
}

// Finds this user's existing Stripe customer (if any prior checkout/portal
// created one) or creates a fresh one, persisting the id so later calls and
// the webhook can find each other without asking Stripe to search by email.
async function getOrCreateCustomerId(userId: string, email: string | null): Promise<string> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured');
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });
  await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, stripe_customer_id: customer.id });
  return customer.id;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: 'not signed in' });
    return;
  }

  const body = req.body as { plan?: unknown };
  if (!isPlanId(body?.plan)) {
    res.status(400).json({ error: 'plan must be "plus" or "studio"' });
    return;
  }

  try {
    const customerId = await getOrCreateCustomerId(user.id, user.email ?? null);
    const origin = originFrom(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceIdForPlan(body.plan), quantity: 1 }],
      // Both paid tiers offer a trial (docs/PRICING.md); card is required
      // up front so Stripe can auto-convert at trial end without a second
      // checkout step.
      subscription_data: { trial_period_days: 14 },
      payment_method_collection: 'always',
      success_url: `${origin}/pricing?checkout=success&plan=${body.plan}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session failed', err);
    res.status(500).json({ error: 'checkout session creation failed' });
  }
}
