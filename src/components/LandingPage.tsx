import { useRef, useState } from 'react';
import type { InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';
import PlayShell from './PlayShell';
import { getRememberedInput, rememberInput, type RememberedInput } from '../lib/inputPreference';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

const STEPS = [
  {
    emoji: '👈',
    title: 'Left hand picks the note',
    body: 'Move it around the note dial to choose a root — A through G.',
  },
  {
    emoji: '👉',
    title: 'Right hand shapes the chord',
    body: 'Major, minor, sevenths and more, then raise your hands to climb octaves.',
  },
  {
    emoji: '✊',
    title: 'Make a fist to lock it',
    body: 'Hold a chord while you move freely — or hit record and share the take.',
  },
];

const FEATURES = [
  { emoji: '🎹', label: 'Three instruments', sub: 'Synth, piano, guitar' },
  { emoji: '🔒', label: 'Private by design', sub: 'Hand tracking on-device' },
  { emoji: '🔗', label: 'Shareable replays', sub: 'Every take gets a link' },
];

export default function LandingPage() {
  // If the player chose camera or mouse in the last 10 minutes, skip the prompt
  // and start straight away with that choice.
  const [input, setInput] = useState<InputMode | null>(() => getRememberedInput());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);
  const touch = isTouchDevice();

  const choose = (mode: RememberedInput) => {
    rememberInput(mode);
    setInput(mode);
  };

  // Start playing inline — no URL change, same screen.
  if (input) return <PlayShell initialInput={input} />;

  const actions = (
    <div className="landing-v2__actions">
      <button className="landing-v2__btn-primary" onClick={() => choose('camera')}>
        Enable camera
      </button>
      <button className="landing-v2__btn-secondary" onClick={() => choose('mouse')}>
        {touch ? 'Use touch instead' : 'Use mouse instead'}
      </button>
    </div>
  );

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />

      <main className="landing-v2__scroll">
        <section className="landing-v2__hero">
          <FroolaLogo size={64} />
          <p className="landing-v2__eyebrow">Browser instrument · no download</p>
          <h1 className="landing-v2__headline">
            Make music with
            <br />a wave of your hand.
          </h1>
          <p className="landing-v2__tagline">play music with your hands</p>
          <p className="landing-v2__lede">
            Froola reads your hands through the camera and turns motion into chords and
            melody — no instrument, no theory, nothing to install.
          </p>
          {actions}
          <p className="landing-v2__privacy">Camera runs on-device — video never leaves your screen.</p>
          <span className="landing-v2__scroll-hint" aria-hidden="true">scroll to see how ↓</span>
        </section>

        <section className="landing-v2__section">
          <h2 className="landing-v2__section-title">How it works</h2>
          <ol className="landing-v2__steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="landing-v2__step">
                <span className="landing-v2__step-num">{i + 1}</span>
                <span className="landing-v2__step-emoji" aria-hidden="true">{s.emoji}</span>
                <span className="landing-v2__step-title">{s.title}</span>
                <span className="landing-v2__step-body">{s.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-v2__section">
          <ul className="landing-v2__features">
            {FEATURES.map((f) => (
              <li key={f.label} className="landing-v2__feature">
                <span className="landing-v2__feature-emoji" aria-hidden="true">{f.emoji}</span>
                <span className="landing-v2__feature-label">{f.label}</span>
                <span className="landing-v2__feature-sub">{f.sub}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-v2__cta">
          <h2 className="landing-v2__section-title">Ready to play?</h2>
          {actions}
          <p className="landing-v2__privacy">Works in your browser. No sign-up to start.</p>
        </section>
      </main>
    </div>
  );
}
