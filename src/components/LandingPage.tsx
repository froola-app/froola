import { useRef, useState } from 'react';
import type { InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';
import PlayShell from './PlayShell';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

const CONTACT_EMAIL = 'supportfroola@gmail.com';

const STEPS = [
  'Raise your hands to the camera. Two dials appear on screen.',
  'Your left hand moves around one dial to pick the note. Your right hand moves around the other to pick the chord.',
  'Lift your hands higher for higher notes, lower them for deeper ones.',
  'Choose synth or piano, then record what you play and share it with a link.',
];

export default function LandingPage() {
  const [input, setInput] = useState<InputMode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);
  const touch = isTouchDevice();

  const choose = (mode: InputMode) => setInput(mode);

  // Start playing inline, no URL change, same screen.
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

      <div className="landing-v2__scroll">
        <header className="landing-v2__topbar">
          <a className="landing-v2__topbar-link" href={`mailto:${CONTACT_EMAIL}`}>
            Contact
          </a>
        </header>

        <main>
          <section className="landing-v2__hero">
            <FroolaLogo size={64} />
            <h1 className="landing-v2__headline">Make music with your hands.</h1>
            <p className="landing-v2__tagline">play music with your hands</p>
            <p className="landing-v2__lede">
              Froola turns the way you move into chords and melody, right in your browser.
              Nothing to buy, no theory to learn. Move your hands and listen.
            </p>
            {actions}
            <p className="landing-v2__note">Your camera is processed on your device.</p>
            <span className="landing-v2__scroll-hint" aria-hidden="true">scroll to see how it works</span>
          </section>

          <section className="landing-v2__section">
            <h2 className="landing-v2__section-title">How it works</h2>
            <ol className="landing-v2__steps">
              {STEPS.map((step, i) => (
                <li key={i} className="landing-v2__step">
                  <span className="landing-v2__step-num">{i + 1}</span>
                  <span className="landing-v2__step-text">{step}</span>
                </li>
              ))}
            </ol>
            <p className="landing-v2__steps-more">More ways to play are on the way.</p>
          </section>

          <section className="landing-v2__mission">
            <h2 className="landing-v2__section-title">Why we built it</h2>
            <p className="landing-v2__mission-body">
              We think making music should be open to everyone, not just people who own an
              instrument or took years of lessons. Froola is our attempt at that: a way to
              play just by moving your hands.
            </p>
            <p className="landing-v2__mission-by">Built by two high school students.</p>
          </section>

          <section className="landing-v2__contact">
            <h2 className="landing-v2__section-title">Get in touch</h2>
            <p className="landing-v2__contact-body">
              Have a question, an idea, or just want to say hi? We would love to hear from you.
            </p>
            <a className="landing-v2__email" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            {actions}
          </section>
        </main>
      </div>
    </div>
  );
}
