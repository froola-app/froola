import { useState } from 'react';
import { PRICING_TIERS, TRIAL_DAYS, type BillingInterval } from '../pricingTiers';

// Scratch page for comparing pricing-page layout ideas. Not linked from the
// app; visit /pricing-mockups directly. Safe to delete once a direction is
// picked — see route registration in App.tsx.

function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={'lp4__pricing-card' + (highlight ? ' lp4__pricing-card--highlight' : '')}>
      {children}
    </div>
  );
}

function Head({ name, badge }: { name: string; badge?: string }) {
  return (
    <div className="lp4__pricing-head">
      <h3 className="lp4__pricing-name">{name}</h3>
      {badge && <span className="lp4__pricing-badge">{badge}</span>}
    </div>
  );
}

function Features({ features }: { features: string[] }) {
  return (
    <ul className="lp4__pricing-features">
      {features.map(f => <li key={f}>{f}</li>)}
    </ul>
  );
}

function FakeCta({ label }: { label: string }) {
  return <button className="lp4__pricing-cta" disabled>{label}</button>;
}

// ---------- Option 1: monthly primary, weekly as fine print ----------

function Option1() {
  return (
    <div className="lp4__pricing-grid">
      {PRICING_TIERS.map(tier => (
        <Card key={tier.name} highlight={tier.highlight}>
          <Head name={tier.name} badge={tier.badge} />
          <p className="lp4__pricing-price">
            {tier.price.month}
            {tier.planId && <span className="lp4__pricing-period">/mo</span>}
          </p>
          {tier.planId && tier.price.week && (
            <p className="lp4__pricing-note lp4__pricing-note--muted">
              or {tier.price.week}/wk billed weekly
            </p>
          )}
          {tier.planId && (
            <p className="lp4__pricing-note">
              {tier.monthlySavings} · {TRIAL_DAYS}-day free trial
            </p>
          )}
          <Features features={tier.features} />
          {tier.planId && <FakeCta label={`Try ${TRIAL_DAYS} days free`} />}
          {!tier.planId && <p className="lp4__pricing-current">Free forever</p>}
        </Card>
      ))}
    </div>
  );
}

// ---------- Option 2: toggle stays, but both prices always shown ----------

function Option2() {
  const [interval, setInterval] = useState<BillingInterval>('week');
  return (
    <>
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
          const other = interval === 'week' ? tier.price.month : tier.price.week;
          const otherPeriod = interval === 'week' ? '/mo' : '/wk';
          return (
            <Card key={tier.name} highlight={tier.highlight}>
              <Head name={tier.name} badge={tier.badge} />
              <p className="lp4__pricing-price">
                {price}
                {period && <span className="lp4__pricing-period">{period}</span>}
              </p>
              {tier.planId && other && (
                <p className="lp4__pricing-note lp4__pricing-note--muted">
                  <s>{other}{otherPeriod}</s>{' '}
                  {interval === 'week' ? tier.monthlySavings : 'billed weekly instead'}
                </p>
              )}
              {tier.planId && interval === 'month' && (
                <p className="lp4__pricing-note">{TRIAL_DAYS}-day free trial</p>
              )}
              <Features features={tier.features} />
              {tier.planId && (
                <FakeCta label={interval === 'month' ? `Try ${TRIAL_DAYS} days free` : 'Upgrade'} />
              )}
              {!tier.planId && <p className="lp4__pricing-current">Free forever</p>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ---------- Option 3: "starting at" + disclosure for the breakdown ----------

function Option3() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="lp4__pricing-grid">
      {PRICING_TIERS.map(tier => (
        <Card key={tier.name} highlight={tier.highlight}>
          <Head name={tier.name} badge={tier.badge} />
          <p className="lp4__pricing-price">
            {tier.price.week ?? tier.price.month}
            {tier.planId && <span className="lp4__pricing-period">/wk</span>}
          </p>
          {tier.planId && (
            <button
              className="lp4__pricing-note lp4__pricing-note--link"
              onClick={() => setOpen(open === tier.name ? null : tier.name)}
            >
              {open === tier.name ? 'Hide' : 'See'} monthly price ▾
            </button>
          )}
          {tier.planId && open === tier.name && (
            <p className="lp4__pricing-note">
              {tier.price.month}/mo · {tier.monthlySavings} · {TRIAL_DAYS}-day free trial
            </p>
          )}
          <Features features={tier.features} />
          {tier.planId && <FakeCta label="Upgrade" />}
          {!tier.planId && <p className="lp4__pricing-current">Free forever</p>}
        </Card>
      ))}
    </div>
  );
}

export default function PricingMockups() {
  return (
    <div className="lp4" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 64, alignItems: 'center' }}>
      <section style={{ maxWidth: 980, width: '100%' }}>
        <h2 className="lp4__h2">Option 1 — Monthly primary, weekly as fine print</h2>
        <p className="lp4__prose">No toggle. Every card leads with the monthly price; the weekly rate is a small muted line underneath.</p>
        <Option1 />
      </section>

      <section style={{ maxWidth: 980, width: '100%' }}>
        <h2 className="lp4__h2">Option 2 — Toggle, but both prices always shown</h2>
        <p className="lp4__prose">Keeps the weekly/monthly toggle. Whichever tab is active, the other interval's price shows struck-through underneath so the trade-off is never hidden.</p>
        <Option2 />
      </section>

      <section style={{ maxWidth: 980, width: '100%' }}>
        <h2 className="lp4__h2">Option 3 — "Starting at" + disclosure</h2>
        <p className="lp4__prose">Leads with the low weekly number; a "See monthly price" link expands the better-value option on demand.</p>
        <Option3 />
      </section>
    </div>
  );
}
