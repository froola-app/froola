import { stripe } from './_lib/stripe.ts';
import { getUserFromAuthHeader, supabaseAdmin } from './_lib/supabaseAdmin.ts';
import { originFrom, type ApiRequest, type ApiResponse } from './_lib/http.ts';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user || !supabaseAdmin) {
    res.status(401).json({ error: 'not signed in' });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    res.status(400).json({ error: 'no billing account yet — subscribe first' });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${originFrom(req)}/pricing`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-portal-session failed', err);
    res.status(500).json({ error: 'portal session creation failed' });
  }
}
