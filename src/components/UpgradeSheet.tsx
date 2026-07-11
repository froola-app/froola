import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, warmCheckoutApi, type PlanId } from '../billing';
import FroolaLogo from './FroolaLogo';
import { useTheme } from '../useTheme';

// The feature the user just reached for — drives the headline so the sheet
// sells that feature, not a generic plan grid.
export type LockedFeature = 'piano' | 'video' | 'replay-length' | 'themes';

const FEATURE_COPY: Record<LockedFeature, { title: string; body: string; recommend: PlanId }> = {
  piano: {
    title: 'The piano is waiting.',
    body: 'A real sampled grand under your hands — Plus swaps the synth for the full piano, any time you want it.',
    recommend: 'plus',
  },
  video: {
    title: 'Keep what you just played.',
    body: 'Record your session as a video — your hands, your sound, ready to download and share anywhere.',
    recommend: 'plus',
  },
  themes: {
    title: 'Re-ink your instrument.',
    body: 'Ember, neon, ocean, mono — Plus recolors the wheels and orbs to match your mood. Same pro instrument, your palette.',
    recommend: 'plus',
  },
  'replay-length': {
    title: 'Twenty seconds went fast.',
    body: 'Plus extends your replays and drops the watermark. Studio never asks you to stop.',
    recommend: 'plus',
  },
};

// Weekly price up front (matches the pricing page default); checkout from
// here uses the weekly interval too, so the number shown is the number paid.
const PLAN_CARDS: { id: PlanId; name: string; price: string; perks: string[] }[] = [
  {
    id: 'plus',
    name: 'Plus',
    price: '$1.99/wk',
    perks: ['Piano instrument', 'Recordings & replays up to 3 min', 'No watermark', 'Chord looper', 'Visual themes'],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$3.99/wk',
    perks: ['Everything in Plus', 'Recordings & replays up to 5 min', 'Audio download (MP3 / WAV) & MIDI', 'Early access features'],
  },
];

// In-context upsell: a small glass sheet over the play canvas instead of a
// hard navigation to /pricing, so trying a locked control never yanks the
// user out of their session.
export default function UpgradeSheet({ feature, onClose }: { feature: LockedFeature; onClose: () => void }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, authReady, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState<PlanId | null>(null);
  const copy = FEATURE_COPY[feature];

  useEffect(() => { warmCheckoutApi(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleUpgrade(plan: PlanId) {
    if (!user) {
      // Same contract as PricingSection's UpgradeButton: kick off sign-in and
      // let the user click again once the popup completes.
      try { await signInWithGoogle(); } catch { /* popup blocked or closed */ }
      return;
    }
    setPending(plan);
    await startCheckout(plan, 'week');
    setPending(null);
  }

  return (
    <div className="upsheet-overlay" onClick={onClose} role="presentation">
      <div
        className="upsheet"
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade Froola"
        onClick={e => e.stopPropagation()}
      >
        <button className="upsheet__close" onClick={onClose} aria-label="Close">×</button>
        <FroolaLogo size={28} color={theme === 'dark' ? '#F5F5F7' : '#111111'} />
        <h2 className="upsheet__title">{copy.title}</h2>
        <p className="upsheet__body">{copy.body}</p>

        <div className="upsheet__plans">
          {PLAN_CARDS.map(plan => (
            <div
              key={plan.id}
              className={'upsheet__plan' + (plan.id === copy.recommend ? ' upsheet__plan--rec' : '')}
            >
              <div className="upsheet__plan-head">
                <span className="upsheet__plan-name">{plan.name}</span>
                <span className="upsheet__plan-price">{plan.price}</span>
              </div>
              <ul className="upsheet__perks">
                {plan.perks.map(p => <li key={p}>{p}</li>)}
              </ul>
              <button
                className={'upsheet__cta' + (plan.id === copy.recommend ? ' upsheet__cta--rec' : '')}
                disabled={!authReady || pending !== null}
                onClick={() => void handleUpgrade(plan.id)}
              >
                {pending === plan.id ? 'Redirecting…'
                  : user ? `Unlock ${plan.name}` : `Sign in & unlock ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div className="upsheet__foot">
          <button className="upsheet__link" onClick={() => navigate('/pricing')}>
            Compare all plans
          </button>
          <button className="upsheet__link upsheet__link--dim" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
