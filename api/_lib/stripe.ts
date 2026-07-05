import Stripe from 'stripe';
import type { PlanId } from '../../src/pricingTiers.ts';

export type { PlanId };

// Server-only — STRIPE_SECRET_KEY has no VITE_ prefix so it's never bundled
// to the browser. Pin apiVersion explicitly rather than relying on the
// account dashboard default, so a dashboard change can't silently alter
// this endpoint's behavior.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

export function priceIdForPlan(plan: PlanId): string {
  const priceId = plan === 'plus' ? process.env.STRIPE_PRICE_PLUS : process.env.STRIPE_PRICE_STUDIO;
  if (!priceId) throw new Error(`missing price id env var for plan "${plan}"`);
  return priceId;
}

// Inverse of priceIdForPlan — used by the webhook to turn a subscription's
// Price back into the plan name stored on profiles.
export function planForPriceId(priceId: string): PlanId | null {
  if (priceId === process.env.STRIPE_PRICE_PLUS) return 'plus';
  if (priceId === process.env.STRIPE_PRICE_STUDIO) return 'studio';
  return null;
}
