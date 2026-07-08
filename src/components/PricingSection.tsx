import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, warmCheckoutApi, type PlanId } from '../billing';
import { PRICING_TIERS, TRIAL_DAYS, type BillingInterval } from '../pricingTiers';
import SmileAccent from './SmileAccent';

function UpgradeButton({ planId, interval, currentPlan }: {
  planId: PlanId;
  interval: BillingInterval;
  currentPlan: PlanId | 'free';
}) {
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
    await startCheckout(planId, interval);
    setPending(false);
  }

  const label = interval === 'month' ? `Try ${TRIAL_DAYS} days free` : 'Upgrade';
  return (
    <button
      className="lp4__pricing-cta"
      disabled={!authReady || pending}
      onClick={() => void handleClick()}
    >
      {pending ? 'Redirecting…' : user ? label : 'Sign in to upgrade'}
    </button>
  );
}

export default function PricingSection() {
  const { profile } = useAuth();
  const currentPlan = profile?.plan ?? 'free';
  // Weekly first: the small number is what people see before they choose.
  const [interval, setInterval] = useState<BillingInterval>('week');

  // Warm the checkout function as soon as pricing is on screen, so clicking
  // Upgrade doesn't stack a serverless cold start on top of the redirect.
  useEffect(() => { warmCheckoutApi(); }, []);

  return (
    <section className="lp4__section" id="pricing" data-reveal>
      <h2 className="lp4__h2">Pricing that plays fair.</h2>
      <SmileAccent />
      <p className="lp4__prose">
        Free forever. Plus and Studio add more instruments, longer recordings,
        and pro tools. Cancel anytime.
      </p>

      <div className="lp4__pricing-toggle" role="group" aria-label="Billing interval">
        <button
          className={'lp4__pricing-toggle-btn' + (interval === 'week' ? ' is-active' : '')}
          onClick={() => setInterval('week')}
        >
          Weekly
        </button>
        <button
          className={'lp4__pricing-toggle-btn' + (interval === 'month' ? ' is-active' : '')}
          onClick={() => setInterval('month')}
        >
          Monthly
          <span className="lp4__pricing-toggle-save">save up to 48%</span>
        </button>
      </div>

      <div className="lp4__pricing-grid">
        {PRICING_TIERS.map(tier => {
          const price = interval === 'week' && tier.price.week ? tier.price.week : tier.price.month;
          const period = tier.planId ? (interval === 'week' ? '/wk' : '/mo') : undefined;
          return (
            <div
              key={tier.name}
              className={'lp4__pricing-card' + (tier.highlight ? ' lp4__pricing-card--highlight' : '')}
            >
              <div className="lp4__pricing-head">
                <h3 className="lp4__pricing-name">{tier.name}</h3>
                {tier.badge && <span className="lp4__pricing-badge">{tier.badge}</span>}
              </div>
              <p className="lp4__pricing-price">
                {price}
                {period && <span className="lp4__pricing-period">{period}</span>}
              </p>
              {tier.planId && interval === 'month' && (
                <p className="lp4__pricing-note">
                  {tier.monthlySavings} · {TRIAL_DAYS}-day free trial
                </p>
              )}
              <ul className="lp4__pricing-features">
                {tier.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {tier.planId && (
                <UpgradeButton planId={tier.planId} interval={interval} currentPlan={currentPlan} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
