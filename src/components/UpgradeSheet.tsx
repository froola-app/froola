import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, warmCheckoutApi, type PlanId } from '../billing';
import FroolaLogo from './FroolaLogo';
import { useTheme } from '../useTheme';

// The feature the user just reached for — drives the headline so the sheet
// sells that feature, not a generic plan grid.
export type LockedFeature =
  | 'piano' | 'video' | 'replay-length' | 'themes'
  | 'recordings' | 'loop' | 'arp' | 'wheels' | 'mp3';

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
    title: 'That take deserved more time.',
    body: 'Plus extends your replays to 3 minutes and drops the watermark. Studio never asks you to stop.',
    recommend: 'plus',
  },
  recordings: {
    title: 'That was worth keeping.',
    body: 'Record what you play and share it as a replay link anyone can watch — up to 3 minutes on Plus, watermark-free.',
    recommend: 'plus',
  },
  loop: {
    title: 'Build a loop. Solo over it.',
    body: 'Capture chords into a repeating progression, then play on top of your own backing — 8 slots on Plus, unlimited on Studio.',
    recommend: 'plus',
  },
  arp: {
    title: 'Set your chords in motion.',
    body: 'The arpeggiator turns a held chord into a rolling, rhythmic pattern — instant texture under everything you play.',
    recommend: 'plus',
  },
  wheels: {
    title: 'Build your own wheel.',
    body: 'Any root, any quality on every slice — Plus lets you swap iii for III, borrow bVII, and make the wheel play your progression.',
    recommend: 'plus',
  },
  mp3: {
    title: 'Take the audio with you.',
    body: 'Export what you just played as an MP3 — Plus unlocks the download, no video required.',
    recommend: 'plus',
  },
};

// Weekly price up front (matches the pricing page default); checkout from
// here uses the weekly interval too, so the number shown is the number paid.
const PLANS: Record<PlanId, { name: string; price: string; perks: string[]; alt: string }> = {
  plus: {
    name: 'Plus',
    price: '$1.99/wk',
    perks: [
      'Piano instrument',
      'Record & share replays and videos, up to 3 min',
      'No watermark',
      'Chord looper & arpeggiator',
      'Visual themes',
    ],
    alt: 'everything here, longer recordings & no caps on loops',
  },
  studio: {
    name: 'Studio',
    price: '$3.99/wk',
    perks: [
      'Everything in Plus',
      'Recordings & replays up to 5 min',
      'Audio download (MP3 / WAV) & MIDI export',
      'Unlimited loop slots',
      'Early access features',
    ],
    alt: 'audio & MIDI export, 5-minute recordings, unlimited loops',
  },
};

// In-context upsell: a small glass sheet over the play canvas instead of a
// hard navigation to /pricing. One recommended plan carries the moment; the
// other tier is a single quiet line, so it reads as an invitation rather
// than a paywall grid.
export default function UpgradeSheet({ feature, onClose }: { feature: LockedFeature; onClose: () => void }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, authReady, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState<PlanId | null>(null);
  const copy = FEATURE_COPY[feature];
  const rec = PLANS[copy.recommend];
  const altId: PlanId = copy.recommend === 'plus' ? 'studio' : 'plus';
  const alt = PLANS[altId];

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

        <div className="upsheet__hero">
          <div className="upsheet__plan-head">
            <span className="upsheet__plan-name">{rec.name}</span>
            <span className="upsheet__plan-price">{rec.price}</span>
          </div>
          <ul className="upsheet__perks">
            {rec.perks.map(p => <li key={p}>{p}</li>)}
          </ul>
          <button
            className="upsheet__cta upsheet__cta--rec"
            disabled={!authReady || pending !== null}
            onClick={() => void handleUpgrade(copy.recommend)}
          >
            {pending === copy.recommend ? 'Redirecting…'
              : user ? `Unlock ${rec.name} — ${rec.price}` : `Sign in & unlock ${rec.name}`}
          </button>
          <p className="upsheet__assure">Cancel anytime · monthly billing has a free trial</p>
        </div>

        <button
          className="upsheet__alt"
          disabled={!authReady || pending !== null}
          onClick={() => void handleUpgrade(altId)}
        >
          {pending === altId ? 'Redirecting…'
            : <>Or <strong>{alt.name}</strong> at {alt.price} — {alt.alt}</>}
        </button>

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
