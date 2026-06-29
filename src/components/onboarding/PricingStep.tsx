interface Props {
  onContinue: () => void;
}

const FREE_FEATURES = [
  'Both instruments (synth, piano)',
  'Camera mode & mouse mode',
  'Recordings up to 60 seconds',
  'Share links',
];

const PRO_FEATURES = [
  'Unlimited recordings',
  'Download audio (MP3 / WAV)',
  'Watermark-free share links',
  'More instrument packs',
  'Loop & layer tracks',
  'MIDI export',
];

export default function PricingStep({ onContinue }: Props) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-eyebrow">Pricing</p>
      <h2 className="onboarding-title">Free forever, upgrade when you're ready</h2>
      <div className="pricing-cards">
        <div className="pricing-card pricing-card--free">
          <h3>Free</h3>
          <ul>
            {FREE_FEATURES.map(f => (
              <li key={f}><span className="check">✓</span> {f}</li>
            ))}
          </ul>
        </div>
        <div className="pricing-card pricing-card--pro">
          <h3>Pro <span className="pro-badge">coming soon</span></h3>
          <ul>
            {PRO_FEATURES.map(f => (
              <li key={f}><span className="check">✓</span> {f}</li>
            ))}
          </ul>
        </div>
      </div>
      <button className="onboarding-btn" onClick={onContinue}>
        Start playing →
      </button>
    </div>
  );
}
