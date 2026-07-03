interface Props {
  onContinue: () => void;
}

interface Tier {
  name: string;
  price: string;
  period?: string;
  badge?: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: Tier[] = [
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
    name: 'Encore',
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
    name: 'Pro',
    price: '$19.99',
    period: '/mo',
    badge: 'coming soon',
    highlight: true,
    features: [
      'Everything in Encore',
      'Continuous instant-replay recording',
      'Unlimited recording length',
      'Download audio (MP3 / WAV) & MIDI export',
      'Unlimited loop & layer slots',
      'Early access to new features',
    ],
  },
];

export default function PricingStep({ onContinue }: Props) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-eyebrow">Pricing</p>
      <h2 className="onboarding-title">Free forever, upgrade when you're ready</h2>
      <div className="pricing-cards">
        {TIERS.map(tier => (
          <div
            key={tier.name}
            className={'pricing-card' + (tier.highlight ? ' pricing-card--pro' : '')}
          >
            <h3>
              {tier.name}
              {tier.badge && <span className="pro-badge">{tier.badge}</span>}
            </h3>
            <p className="pricing-card-price">
              {tier.price}
              {tier.period && <span className="pricing-card-period">{tier.period}</span>}
            </p>
            <ul>
              {tier.features.map(f => (
                <li key={f}><span className="check">✓</span> {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="onboarding-btn" onClick={onContinue}>
        Start playing →
      </button>
    </div>
  );
}
