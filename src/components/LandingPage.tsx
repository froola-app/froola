import { useEffect, useRef, useState } from 'react';
import type { InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import PlayShell from './PlayShell';

const WAVE_BARS = 40;
const CONTACT_EMAIL = 'supportfroola@gmail.com';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

const STEPS = [
  {
    num: '01',
    title: 'Allow camera',
    body: 'Nothing is recorded or sent anywhere — all processing happens locally in your browser.',
  },
  {
    num: '02',
    title: 'Move your hands',
    body: 'Horizontal position picks the chord. Vertical height shapes the melody.',
  },
  {
    num: '03',
    title: 'Make music',
    body: 'Real chords, real harmony, in real time. Every position sounds good by design.',
  },
];

function WaveVisual() {
  const barsRef = useRef<HTMLDivElement[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const animate = (ts: number) => {
      const t = ts / 1000;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const phase = (i / WAVE_BARS) * Math.PI * 3;
        const h =
          12 +
          Math.sin(phase + t * 1.4) * 18 +
          Math.sin(phase * 0.6 + t * 0.8) * 12 +
          Math.sin(phase * 1.4 + t * 2.2) * 6;
        bar.style.height = `${Math.max(3, h)}px`;
      });
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className="lp3__wave">
      {Array.from({ length: WAVE_BARS }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { if (el) barsRef.current[i] = el; }}
          className="lp3__wave-bar"
          style={{ background: i % 7 === 0 ? '#D4500A' : 'rgba(17,17,17,0.12)' }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [input, setInput] = useState<InputMode | null>(null);
  const touch = isTouchDevice();

  if (input) return <PlayShell initialInput={input} />;

  return (
    <div className="lp3">
      {/* Nav */}
      <nav className="lp3__nav">
        <a href={`mailto:${CONTACT_EMAIL}`} className="lp3__nav-link">
          Contact
        </a>
      </nav>

      {/* Hero */}
      <section className="lp3__hero">
        <FroolaLogo size={56} />

        <h1 className="lp3__headline">Make music<br />with your hands.</h1>

        <div className="lp3__wave-wrap">
          <WaveVisual />
        </div>

        <div className="lp3__actions">
          <button className="lp3__btn-primary" onClick={() => setInput('camera')}>
            Enable camera
          </button>
          <button className="lp3__btn-secondary" onClick={() => setInput('mouse')}>
            {touch ? 'Use touch instead' : 'Use mouse instead'}
          </button>
        </div>

        <a href="#how" className="lp3__scroll-hint">
          Scroll to see how it works
        </a>
      </section>

      {/* How it works */}
      <section id="how" className="lp3__scroll-section">
        <p className="lp3__label">How it works</p>
        <div className="lp3__steps">
          {STEPS.map((step) => (
            <div key={step.num} className="lp3__step">
              <span className="lp3__step-num">{step.num}</span>
              <h3 className="lp3__step-heading">{step.title}</h3>
              <p className="lp3__step-body">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why we built it */}
      <section className="lp3__scroll-section">
        <p className="lp3__label">Why we built it</p>
        <div className="lp3__prose">
          <p className="lp3__prose-body">
            We think making music should be open to everyone, not just people
            who own an instrument or took years of lessons. Froola is our
            attempt at that: a way to play just by moving your hands.
          </p>
          <a href="#" className="lp3__byline">Built by two high school students.</a>
        </div>
      </section>

      {/* Get in touch */}
      <section id="contact" className="lp3__scroll-section">
        <p className="lp3__label">Get in touch</p>
        <div className="lp3__prose">
          <p className="lp3__prose-body">
            Have a question, an idea, or just want to say hi? We would love to
            hear from you.
          </p>
          <a className="lp3__email" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <div className="lp3__actions lp3__actions--contact">
            <button className="lp3__btn-primary" onClick={() => setInput('camera')}>
              Enable camera
            </button>
            <button className="lp3__btn-secondary" onClick={() => setInput('mouse')}>
              {touch ? 'Use touch instead' : 'Use mouse instead'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp3__footer">
        <span className="lp3__footer-copy">froola © 2026</span>
      </footer>
    </div>
  );
}
