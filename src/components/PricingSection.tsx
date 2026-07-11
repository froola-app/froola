import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, warmCheckoutApi, type PlanId } from '../billing';
import { PRICING_TIERS, TRIAL_DAYS, type BillingInterval } from '../pricingTiers';
import SmileAccent from './SmileAccent';

const PLUS_TIER = PRICING_TIERS.find(t => t.planId === 'plus')!;

// Feature matrix for the comparison table. Strings render as-is; true renders
// a check, false a dash. Kept here (not pricingTiers.ts) because it's purely
// presentational — entitlements still come from the tier lists / server.
const FEATURE_ROWS: { label: string; free: ReactNode | boolean; plus: ReactNode | boolean; studio: ReactNode | boolean }[] = [
  { label: 'Instruments', free: 'Synth', plus: 'Synth + Piano', studio: 'Synth + Piano' },
  { label: 'Camera hand tracking', free: true, plus: true, studio: true },
  { label: 'Recording & shareable replays', free: '20s, watermarked', plus: '3 min, no watermark', studio: '5 min, no watermark' },
  { label: 'Chord looper', free: false, plus: '8 slots', studio: 'Unlimited slots' },
  { label: 'Visual themes', free: false, plus: true, studio: true },
  { label: 'Continuous instant-replay recording', free: false, plus: false, studio: true },
  { label: 'Audio & MIDI export', free: false, plus: false, studio: 'MP3 · WAV · MIDI' },
  { label: 'Early access to new features', free: false, plus: false, studio: true },
];

function Cell({ value }: { value: ReactNode | boolean }) {
  if (value === true) return <span className="lp4__cmp-check" aria-label="Included">✓</span>;
  if (value === false) return <span className="lp4__cmp-dash" aria-label="Not included">—</span>;
  return <>{value}</>;
}

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

  const label = interval === 'month' ? `Try ${TRIAL_DAYS} days free` : 'Get Plus';
  return (
    <button
      className="lp4__pricing-cta lp4__cmp-cta"
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

  const plusPrice = interval === 'week' ? PLUS_TIER.price.week : PLUS_TIER.price.month;

  return (
    <section className="lp4__section" id="pricing" data-reveal>
      <h2 className="lp4__h2">Pricing that plays fair.</h2>
      <SmileAccent />
      <p className="lp4__prose">
        One plan worth paying for. Everything else is free, forever.
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
        </button>
      </div>

      <div className="lp4__cmp-scroll">
        <div className="lp4__cmp" role="table" aria-label="Plan comparison">
          <div className="lp4__cmp-row lp4__cmp-row--head" role="row">
            <div className="lp4__cmp-lead" role="columnheader" />
            <div className="lp4__cmp-plan" role="columnheader">
              <h3 className="lp4__cmp-name">Free</h3>
              <p className="lp4__cmp-price">$0</p>
              <p className="lp4__cmp-sub">Everything you need to start. No card required.</p>
              <p className="lp4__pricing-current">Free forever</p>
            </div>
            <div className="lp4__cmp-plan is-plus" role="columnheader">
              <h3 className="lp4__cmp-name">Plus</h3>
              {/* key remounts the price so the fade replays on toggle */}
              <p className="lp4__cmp-price" key={interval}>
                {plusPrice}
                <span className="lp4__cmp-period">{interval === 'week' ? '/week' : '/month'}</span>
              </p>
              <p className="lp4__cmp-sub">
                {interval === 'month'
                  ? `${PLUS_TIER.monthlySavings} · ${TRIAL_DAYS}-day free trial`
                  : 'Cancel anytime.'}
              </p>
              <UpgradeButton planId="plus" interval={interval} currentPlan={currentPlan} />
            </div>
            <div className="lp4__cmp-plan" role="columnheader">
              <div className="lp4__pricing-name-row">
                <h3 className="lp4__cmp-name">Studio</h3>
                <span className="lp4__pricing-badge">Coming soon</span>
              </div>
              <p className="lp4__cmp-price lp4__cmp-price--muted">Pricing at launch</p>
              <p className="lp4__cmp-sub">The full production toolkit.</p>
              {currentPlan === 'studio' && <p className="lp4__pricing-current">Your current plan</p>}
            </div>
          </div>

          {FEATURE_ROWS.map(row => (
            <div className="lp4__cmp-row" role="row" key={row.label}>
              <div className="lp4__cmp-lead" role="rowheader">{row.label}</div>
              <div className="lp4__cmp-cell" role="cell"><Cell value={row.free} /></div>
              <div className="lp4__cmp-cell is-plus" role="cell"><Cell value={row.plus} /></div>
              <div className="lp4__cmp-cell" role="cell"><Cell value={row.studio} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
