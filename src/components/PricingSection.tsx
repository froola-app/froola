import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, type PlanId } from '../billing';
import { PRICING_TIERS } from '../pricingTiers';
import SmileAccent from './SmileAccent';

function UpgradeButton({ planId, currentPlan }: { planId: PlanId; currentPlan: PlanId | 'free' }) {
  const { user, authReady, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);

  if (currentPlan === planId) {
    return <p className="lp4__pricing-current">Your current plan</p>;
  }

  async function handleClick() {
    if (!user) {
      // Not signed in yet — start sign-in and let the user click again
      // once it completes; signInWithGoogle only resolves once the popup
      // opens, not once auth finishes, so we can't chain straight into
      // checkout here.
      try { await signInWithGoogle(); } catch { /* popup blocked or closed */ }
      return;
    }
    setPending(true);
    await startCheckout(planId);
    setPending(false);
  }

  return (
    <button
      className="lp4__pricing-cta"
      disabled={!authReady || pending}
      onClick={() => void handleClick()}
    >
      {pending ? 'Redirecting…' : user ? 'Upgrade' : 'Sign in to upgrade'}
    </button>
  );
}

export default function PricingSection() {
  const { profile } = useAuth();
  const currentPlan = profile?.plan ?? 'free';

  return (
    <section className="lp4__section" id="pricing" data-reveal>
      <h2 className="lp4__h2">Pricing that plays fair.</h2>
      <SmileAccent />
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
            {tier.planId && <UpgradeButton planId={tier.planId} currentPlan={currentPlan} />}
          </div>
        ))}
      </div>
    </section>
  );
}
