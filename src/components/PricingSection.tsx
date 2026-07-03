import { PRICING_TIERS } from '../pricingTiers';

export default function PricingSection() {
  return (
    <section className="lp4__section" id="pricing" data-reveal>
      <h2 className="lp4__h2">Pricing that plays fair.</h2>
      <p className="lp4__prose">
        Free forever. Plus and Studio add more instruments, longer recordings,
        and pro tools. Billed monthly, cancel anytime.
      </p>
      <div className="lp4__pricing-grid">
        {PRICING_TIERS.map(tier => (
          <div
            key={tier.name}
            className={'lp4__pricing-card' + (tier.highlight ? ' lp4__pricing-card--highlight' : '')}
          >
            <div className="lp4__pricing-head">
              <h3 className="lp4__pricing-name">{tier.name}</h3>
              {tier.badge && <span className="lp4__pricing-badge">{tier.badge}</span>}
            </div>
            <p className="lp4__pricing-price">
              {tier.price}
              {tier.period && <span className="lp4__pricing-period">{tier.period}</span>}
            </p>
            <ul className="lp4__pricing-features">
              {tier.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
