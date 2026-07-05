import type { PlanId } from '../api/_lib/stripe.ts';

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  badge?: string;
  features: string[];
  highlight?: boolean;
  /** Present only on paid tiers — drives the checkout button in
      PricingSection.tsx. Absent on Free, which has nothing to buy. */
  planId?: PlanId;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    features: [
      'Synth instrument',
      'Camera mode & mouse mode',
      '3 recordings / month, up to 20s',
      'Shareable replay links (watermarked)',
    ],
  },
  {
    name: 'Plus',
    price: '$4.99',
    period: '/mo',
    planId: 'plus',
    features: [
      'Everything in Free',
      'Piano instrument unlocked',
      'Recordings up to 3 minutes, no watermark',
      'Custom visual themes',
    ],
  },
  {
    name: 'Studio',
    price: '$19.99',
    period: '/mo',
    planId: 'studio',
    highlight: true,
    features: [
      'Everything in Plus',
      'Continuous instant-replay recording',
      'Unlimited recording length',
      'Download audio (MP3 / WAV) & MIDI export',
      'Unlimited loop & layer slots',
      'Early access to new features',
    ],
  },
];
