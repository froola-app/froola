import { PRICING_TIERS } from '../../pricingTiers';

interface Props {
  onContinue: () => void;
}

export default function PricingStep({ onContinue }: Props) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-eyebrow">Pricing</p>
      <h2 className="onboarding-title">Free forever, upgrade when you're ready</h2>
      <div className="pricing-cards">
        {PRICING_TIERS.map(tier => (
          <div
            key={tier.name}
            className={'pricing-card' + (tier.highlight ? ' pricing-card--pro' : '')}
          >
            <h3>
              {tier.name}
              {tier.badge && <span className="pro-badge">{tier.badge}</span>}
            </h3>
            <p className="pricing-card-price">
              {tier.price.week ?? tier.price.month}
              {tier.planId && <span className="pricing-card-period">/wk</span>}
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
