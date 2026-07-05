import type Stripe from 'stripe';
import { stripe, planForPriceId } from './_lib/stripe.ts';
import { supabaseAdmin } from './_lib/supabaseAdmin.ts';
import { readRawBody, type ApiRequest, type ApiResponse } from './_lib/http.ts';

// Stripe needs the raw, unparsed body to verify the signature.
export const config = { api: { bodyParser: false } };

async function upsertFromSubscription(subscription: Stripe.Subscription) {
  if (!supabaseAdmin) return;
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (!profile) {
    // Customer was created outside create-checkout-session.ts (shouldn't
    // happen in normal flow) — nothing to attach billing state to.
    console.error('stripe-webhook: no profile for stripe customer', customerId);
    return;
  }

  const item = subscription.items.data[0];
  const plan = item ? planForPriceId(item.price.id) : null;
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  await supabaseAdmin
    .from('profiles')
    .update({
      // Falls back to 'free' on cancellation/unpaid/unrecognized price,
      // so a lapsed subscription can't leave a user stuck on a paid plan.
      plan: isActive && plan ? plan : 'free',
      subscription_status: subscription.status,
      current_period_end: item ? item.current_period_end * 1000 : null,
    })
    .eq('id', profile.id);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || typeof signature !== 'string' || !webhookSecret) {
    res.status(400).json({ error: 'missing signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err);
    res.status(400).json({ error: 'invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (typeof session.subscription === 'string') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await upsertFromSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertFromSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook: handler failed', err);
    res.status(500).json({ error: 'webhook handler failed' });
  }
}
