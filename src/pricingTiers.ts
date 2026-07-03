export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  badge?: string;
  features: string[];
  highlight?: boolean;
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
    badge: 'coming soon',
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
    badge: 'coming soon',
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
