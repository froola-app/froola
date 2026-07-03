import { useEffect, useRef, useState } from 'react';
import { storedInputMode, storeInputMode, type InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import HeroDials from './HeroDials';
import PlayShell from './PlayShell';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

const STEPS = [
  {
    title: 'Allow camera',
    body: 'One click and you’re in. No account, no install, no setup.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
        <path d="M15.5 10.5 21 7.8v8.4l-5.5-2.7" />
      </svg>
    ),
  },
  {
    title: 'Move your hands',
    body: 'Horizontal position picks the chord. Vertical height shapes the melody.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11.5V5.8a1.6 1.6 0 0 1 3.2 0v5" />
        <path d="M10.2 10.8V4.2a1.6 1.6 0 0 1 3.2 0v6.6" />
        <path d="M13.4 11V5.4a1.6 1.6 0 0 1 3.2 0v7.8c0 4-2.4 6.6-5.7 6.6-2.7 0-4.2-1.3-5.6-3.9L3.6 12.7a1.5 1.5 0 0 1 2.6-1.5L7 12.9" />
      </svg>
    ),
  },
  {
    title: 'Make music',
    body: 'Real chords, real harmony, in real time. Every position sounds good by design.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18.5V5.5l11-2v13" />
        <circle cx="6.5" cy="18.5" r="2.5" />
        <circle cx="17.5" cy="16.5" r="2.5" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  // Remembered per tab so leaving for /learn and coming back drops the user
  // straight into the instrument instead of the landing hero.
  const [input, setInput] = useState<InputMode | null>(storedInputMode);
  const rootRef = useRef<HTMLDivElement>(null);
  const touch = isTouchDevice();

  const chooseInput = (mode: 'camera' | 'mouse') => {
    storeInputMode(mode);
    setInput(mode);
  };

  // Scroll reveals: sections fade-rise in once as they enter the viewport.
  useEffect(() => {
    if (input) return;
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll('[data-reveal]'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [input]);

  if (input) return <PlayShell initialInput={input} />;

  const ctas = (
    <div className="lp4__ctas">
      <button className="lp4__pill" onClick={() => chooseInput('camera')}>
        Enable camera
      </button>
      <button className="lp4__link-btn" onClick={() => chooseInput('mouse')}>
        {touch ? 'Use touch instead' : 'Use mouse instead'}
        <span aria-hidden="true"> ›</span>
      </button>
    </div>
  );

  return (
    <div className="lp4" ref={rootRef}>
      {/* Nav */}
      <nav className="lp4__nav">
        <div className="lp4__nav-inner">
          <FroolaLogo size={16} />
          <a href={`mailto:${CONTACT_EMAIL}`} className="lp4__nav-link">
            Contact
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp4__hero">
        <h1 className="lp4__headline">
          Make music
          <br />
          with your hands.
        </h1>
        <p className="lp4__subhead">
          No instrument. No lessons. Just two hands, a camera, and real
          harmony in real time.
        </p>
        {ctas}
        <div className="lp4__stage">
          <HeroDials />
          <p className="lp4__stage-caption">
            Two dials. Your left hand picks the chord, your right hand colors it.
          </p>
        </div>
      </header>

      {/* How it works */}
      <section className="lp4__section lp4__section--alt" data-reveal>
        <h2 className="lp4__h2">How it works</h2>
        <div className="lp4__cards">
          {STEPS.map((step, i) => (
            <div key={step.title} className="lp4__card">
              <span className="lp4__card-icon">{step.icon}</span>
              <span className="lp4__card-step">Step {i + 1}</span>
              <h3 className="lp4__card-title">{step.title}</h3>
              <p className="lp4__card-body">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="lp4__section" data-reveal>
        <span className="lp4__lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h2 className="lp4__h2">Your camera stays yours.</h2>
        <p className="lp4__prose">
          Hand tracking runs entirely on your device. No video is ever
          recorded, stored, or sent anywhere — close the tab and it&rsquo;s gone.
        </p>
      </section>

      {/* Why we built it */}
      <section className="lp4__section lp4__section--alt" data-reveal>
        <h2 className="lp4__h2">Why we built it</h2>
        <p className="lp4__prose">
          We think making music should be open to everyone, not just people
          who own an instrument or took years of lessons. Froola is our
          attempt at that: a way to play just by moving your hands.
        </p>
        <p className="lp4__byline">Built by two high school students.</p>
      </section>

      {/* Final CTA */}
      <section className="lp4__section" data-reveal>
        <h2 className="lp4__h2">Ready to play?</h2>
        {ctas}
      </section>

      {/* Footer */}
      <footer className="lp4__footer">
        <div className="lp4__footer-inner">
          <span>
            Questions or ideas?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
          <span>froola © 2026</span>
        </div>
      </footer>
    </div>
  );
}
