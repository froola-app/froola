// Shared with the api/ serverless functions — this file is the source of
// truth for plan ids so browser code never imports server-only modules.
export type PlanId = 'plus' | 'studio';

// Weekly is the default display interval (small number up front); monthly is
// the "save" option and the only interval that carries a free trial.
export type BillingInterval = 'week' | 'month';

export const TRIAL_DAYS = 5;

export interface PricingTier {
  name: string;
  /** Price per interval. Free tiers only have `month` ($0 either way). */
  price: { week?: string; month: string };
  /** e.g. "Save 42%" — shown when the monthly interval is selected. */
  monthlySavings?: string;
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
    price: { month: '$0' },
    features: [
      'Synth instrument',
      'Camera hand tracking',
      '1 video recording, up to 20s, with shareable link (watermarked)',
    ],
  },
  {
    name: 'Plus',
    price: { week: '$1.99', month: '$4.99' },
    monthlySavings: 'Save 42%',
    planId: 'plus',
    features: [
      'Everything in Free',
      'Piano instrument unlocked',
      'Up to 3 recordings, 3 minutes each, no watermark',
      'MP3 / MP4 export (watermarked)',
      'Chord looper, 8 slots',
      'Visual themes for the wheels & orbs',
    ],
  },
  {
    name: 'Studio',
    price: { week: '$3.99', month: '$8.99' },
    monthlySavings: 'Save 48%',
    planId: 'studio',
    highlight: true,
    badge: 'Coming soon',
    features: [
      'Everything in Plus',
      'Unlimited recordings, up to 5 minutes each',
      'MP3 / MP4 export, no watermark',
      'Camera-only recording (hide the dials)',
      'Unlimited loop & layer slots',
      'Early access to new features',
    ],
  },
];
