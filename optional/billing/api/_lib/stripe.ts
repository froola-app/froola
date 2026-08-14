import Stripe from 'stripe';
import type { BillingInterval, PlanId } from '../../src/pricingTiers.ts';

export type { BillingInterval, PlanId };

// Server-only — STRIPE_SECRET_KEY has no VITE_ prefix so it's never bundled
// to the browser. Pin apiVersion explicitly rather than relying on the
// account dashboard default, so a dashboard change can't silently alter
// this endpoint's behavior.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

const PRICE_ENV: Record<PlanId, Record<BillingInterval, string>> = {
  plus: { week: 'STRIPE_PRICE_PLUS_WEEK', month: 'STRIPE_PRICE_PLUS_MONTH' },
  studio: { week: 'STRIPE_PRICE_STUDIO_WEEK', month: 'STRIPE_PRICE_STUDIO_MONTH' },
};

export function priceIdForPlan(plan: PlanId, interval: BillingInterval): string {
  const priceId = process.env[PRICE_ENV[plan][interval]];
  if (!priceId) throw new Error(`missing price id env var for plan "${plan}" (${interval})`);
  return priceId;
}

// Inverse of priceIdForPlan — used by the webhook to turn a subscription's
// Price back into the plan name stored on profiles. Interval doesn't matter
// there; weekly and monthly grant the same entitlements.
export function planForPriceId(priceId: string): PlanId | null {
  for (const plan of Object.keys(PRICE_ENV) as PlanId[]) {
    for (const envVar of Object.values(PRICE_ENV[plan])) {
      if (process.env[envVar] && priceId === process.env[envVar]) return plan;
    }
  }
  return null;
}
