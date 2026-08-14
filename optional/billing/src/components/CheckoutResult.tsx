import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanId } from '../billing';
import { TRIAL_DAYS } from '../pricingTiers';
import SmileAccent from './SmileAccent';

const PLAN_NAMES: Record<PlanId, string> = { plus: 'Plus', studio: 'Studio' };

// Rainbow confetti weighted toward the brand oranges — festive, but the
// froola color still leads the parade.
const CONFETTI_COLORS = [
  '#f2650f', '#d4500a', '#ff8a3d', '#ffb27d',   // oranges, double weight
  '#f7b32b', '#4cb944', '#31b5d6', '#3a7bff', '#8a5cff', '#ff5c8a',
];

interface Piece {
  x: number; y: number; vy: number;
  sway: number; swaySpeed: number; swayPhase: number;
  w: number; h: number; angle: number; spin: number;
  color: string; round: boolean;
}

function makePiece(w: number, aboveTop: boolean): Piece {
  const size = 5 + Math.random() * 6;
  return {
    x: Math.random() * w,
    // First wave scatters across the upper sky so rain starts everywhere at
    // once; recycled pieces respawn just above the top edge.
    y: aboveTop ? -20 - Math.random() * 300 : -20,
    vy: 0.7 + Math.random() * 1.1,
    sway: 20 + Math.random() * 35,
    swaySpeed: 0.0008 + Math.random() * 0.0012,
    swayPhase: Math.random() * Math.PI * 2,
    w: size,
    h: size * (1.3 + Math.random() * 0.8),
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.06,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    round: Math.random() < 0.25,
  };
}

// Gentle full-width rain that keeps falling while the card is up.
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 110 }, () => makePiece(w, true));

    let raf = 0;
    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y > h + 20) pieces[i] = makePiece(w, false);
        const x = p.x + Math.sin(now * p.swaySpeed + p.swayPhase) * p.sway;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.angle);
        // Flutter: squash the long axis as if the piece is tumbling in air.
        ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(now * 0.002 + p.swayPhase)));
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="lp4__confetti" aria-hidden="true" />;
}

// "Froo la la." with each letter bouncing in like a note; the "la la" sings
// in accent orange.
function JoyfulTitle() {
  const words = ['Froo', 'la', 'la.'];
  let i = 0;
  return (
    <h2 id="checkout-success-title" className="lp4__checkout-title" aria-label="Froo la la.">
      {words.map((word, wi) => (
        <span key={wi} className={'lp4__checkout-word' + (wi > 0 ? ' lp4__checkout-word--accent' : '')} aria-hidden="true">
          {word.split('').map(char => (
            <span
              key={i}
              className="lp4__checkout-char"
              style={{ animationDelay: `${0.25 + i++ * 0.055}s` }}
            >
              {char}
            </span>
          ))}
        </span>
      ))}
    </h2>
  );
}

type CheckoutResultState =
  | { kind: 'success'; plan: PlanId | null; firstCharge: string }
  | { kind: 'cancel' }
  | null;

// Reads ?checkout=success|cancel (and &plan=) left by Stripe's redirect. Runs
// once as the lazy useState initializer (rather than an effect) so the parsed
// result — including the impure "now + trial" date computed for the success
// card — is settled before first paint instead of causing a second render.
function parseCheckoutResult(): CheckoutResultState {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  if (checkout !== 'success' && checkout !== 'cancel') return null;
  if (checkout === 'cancel') return { kind: 'cancel' };
  const plan = params.get('plan');
  const firstCharge = new Date(Date.now() + TRIAL_DAYS * 86_400_000)
    .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return { kind: 'success', plan: plan === 'plus' || plan === 'studio' ? plan : null, firstCharge };
}

/**
 * Post-checkout feedback on /pricing. Reads ?checkout=success|cancel (and
 * &plan=) left by Stripe's redirect, then strips them from the URL so a
 * refresh or share doesn't replay the moment.
 */
export default function CheckoutResult() {
  const navigate = useNavigate();
  const [result, setResult] = useState<CheckoutResultState>(parseCheckoutResult);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    // Runs once against the result captured at mount — re-stripping on every
    // `result` change would be a no-op anyway since the query string is
    // already gone after the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (result?.kind !== 'success') return;
    ctaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setResult(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result?.kind]);

  useEffect(() => {
    if (result?.kind !== 'cancel') return;
    const t = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(t);
  }, [result?.kind]);

  if (!result) return null;

  if (result.kind === 'cancel') {
    return (
      <div className="lp4__checkout-toast" role="status">
        Checkout canceled. No charge was made.
        <button className="lp4__checkout-toast-close" onClick={() => setResult(null)} aria-label="Dismiss">×</button>
      </div>
    );
  }

  const planName = result.plan ? PLAN_NAMES[result.plan] : null;
  const { firstCharge } = result;

  return (
    <div className="lp4__checkout-overlay" onClick={() => setResult(null)}>
      <Confetti />
      <div
        className="lp4__checkout-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-success-title"
        onClick={e => e.stopPropagation()}
      >
        <JoyfulTitle />
        <SmileAccent />
        <p className="lp4__checkout-lede">
          {planName ? `Welcome to Froola ${planName}.` : 'Welcome aboard.'}
          {' '}Everything is unlocked and ready to play.
        </p>
        <p className="lp4__checkout-fine">
          Your {TRIAL_DAYS} day free trial starts now. First charge on {firstCharge},
          cancel anytime before then from your profile.
        </p>
        <button ref={ctaRef} className="lp4__pricing-cta lp4__checkout-cta" onClick={() => navigate('/')}>
          Start playing
        </button>
        <button className="lp4__checkout-later" onClick={() => setResult(null)}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
