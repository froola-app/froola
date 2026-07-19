import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeInputMode } from '../engine/input';
import { SONG_PATH } from '../engine/lessons/curriculum';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTheme } from '../hooks/useTheme';
import HeroDials from './HeroDials';
import LivingLogo from './brand/LivingLogo';
import PricingSection from './pricing/PricingSection';
import ProfileButton from './account/ProfileButton';
import SmileAccent from './brand/SmileAccent';
import ThemeToggle from './ThemeToggle';
import SiteFooter from './docs/SiteFooter';

// Real songs from the lesson curriculum — the marquee shows the product's
// soul (what you actually get to play) instead of empty hero margins.
const MARQUEE_SONGS = SONG_PATH.map(s => ({ title: s.title, artist: s.artist ?? '' }));

// Supporting value props under the privacy statement.
const FEATURES = [
  {
    title: 'Runs on your device',
    body: 'Hand tracking happens in your browser. No video ever leaves your computer.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: 'No sign-up',
    body: 'No account, no install, no setup. Allow the camera and you are playing.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 4 13h7l-1 9 9-11h-7l1-9Z" />
      </svg>
    ),
  },
  {
    title: 'Plays in your browser',
    body: 'Nothing to download. It works on the laptop or phone you already have.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z" />
      </svg>
    ),
  },
];

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
  const rootRef = useRef<HTMLDivElement>(null);
  // Cursor is hovering a primary CTA — the nearest living face perks up.
  const [logoExcited, setLogoExcited] = useState(false);
  const [bandExcited, setBandExcited] = useState(false);
  const introRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Remember the choice so PlayShell on /play skips its own prompt and drops
  // the user straight into the instrument.
  const chooseCamera = () => {
    storeInputMode('camera');
    navigate('/play');
  };

  // Scroll reveals: sections fade-rise in once as they enter the viewport.
  useScrollReveal(rootRef);

  const ctas = (
    <div className="lp4__ctas">
      <button className="lp4__pill" onClick={chooseCamera}>
        Enable camera
      </button>
    </div>
  );

  return (
    <div className="lp4" data-theme={theme} ref={rootRef}>
      {/* Floating corner controls — the page has no nav bar; the hero owns
          the branding and Pricing/Contact live in their section/footer. */}
      <div className="lp4__corner">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <ProfileButton variant="nav" />
      </div>

      {/* Wow hero: the living logo owns the first screen. */}
      <header className="lp4__wow">
        <LivingLogo excited={logoExcited} />
        <div
          className="lp4__wow-ctas"
          onPointerEnter={() => setLogoExcited(true)}
          onPointerLeave={() => setLogoExcited(false)}
        >
          {ctas}
        </div>
        <button
          className="lp4__scroll-cue"
          onClick={() => introRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll to learn more"
        >
          <span>There’s more</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 9 7 7 7-7" />
          </svg>
        </button>
      </header>

      {/* Headline */}
      {/* No data-reveal here: this section peeks above the fold as the
          scroll affordance, so it must be visible from the start. */}
      <section className="lp4__hero" ref={introRef}>
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
        <div className="lp4__trust">
          <span>No sign-up</span>
          <span>Plays in your browser</span>
          <span>Private by design</span>
        </div>
        <div className="lp4__stage">
          <HeroDials />
          <p className="lp4__stage-caption">
            Two dials. Your left hand picks the chord, your right hand colors it.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="lp4__section lp4__section--alt" data-reveal>
        <h2 className="lp4__h2">How it works</h2>
        <SmileAccent />
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

      {/* Songs you can play */}
      <section className="lp4__songs" data-reveal>
        <div className="lp4__songs-head">
          <h2 className="lp4__h2">Songs you already love.</h2>
          <SmileAccent />
          <p className="lp4__prose">
            A guided path of real songs, from your first chord to the last
            chorus. Learn one, then play it end to end.
          </p>
        </div>
        <div className="lp4__marquee" aria-hidden="true">
          <div className="lp4__marquee-row lp4__marquee-row--a">
            {[...MARQUEE_SONGS, ...MARQUEE_SONGS].map((s, i) => (
              <span className="lp4__song-chip" key={`a-${i}`}>
                <span className="lp4__song-title">{s.title}</span>
                <span className="lp4__song-artist">{s.artist}</span>
              </span>
            ))}
          </div>
          <div className="lp4__marquee-row lp4__marquee-row--b">
            {[...MARQUEE_SONGS].reverse().concat([...MARQUEE_SONGS].reverse()).map((s, i) => (
              <span className="lp4__song-chip" key={`b-${i}`}>
                <span className="lp4__song-title">{s.title}</span>
                <span className="lp4__song-artist">{s.artist}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="lp4__songs-cta">
          <button className="lp4__link-btn" onClick={() => navigate('/learn')}>
            Explore the lessons
            <span aria-hidden="true"> ›</span>
          </button>
        </div>
      </section>

      {/* Privacy */}
      <section className="lp4__section lp4__section--alt" data-reveal>
        <h2 className="lp4__h2">Your camera stays yours.</h2>
        <SmileAccent />
        <p className="lp4__prose">
          Everything runs locally, so making music never means handing over
          your video or your data.
        </p>
        <div className="lp4__features">
          {FEATURES.map(f => (
            <div key={f.title} className="lp4__feature">
              <span className="lp4__feature-icon">{f.icon}</span>
              <h3 className="lp4__feature-title">{f.title}</h3>
              <p className="lp4__feature-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why we built it */}
      <section className="lp4__section" data-reveal>
        <h2 className="lp4__h2">Why we built it</h2>
        <SmileAccent />
        <p className="lp4__prose">
          We think making music should be open to everyone, not just people
          who own an instrument or took years of lessons. Froola is our
          attempt at that: a way to play just by moving your hands.
        </p>
        <p className="lp4__byline">Built by two high school students.</p>
      </section>

      <PricingSection />

      {/* Final CTA */}
      <div className="lp4__cta-band-wrap" data-reveal>
        <section className="lp4__cta-band">
          <LivingLogo excited={bandExcited} />
          <h2 className="lp4__h2">Ready to play?</h2>
          <p className="lp4__cta-band-sub">
            Your first chord is one click away. Turn on the camera and start
            making music.
          </p>
          <div
            onPointerEnter={() => setBandExcited(true)}
            onPointerLeave={() => setBandExcited(false)}
          >
            {ctas}
          </div>
        </section>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
