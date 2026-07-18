import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeInputMode } from '../engine/input';
import { SONG_PATH } from '../engine/lessons/curriculum';
import { useScrollReveal } from '../useScrollReveal';
import { useTheme } from '../useTheme';
import Footer from './Footer';
import FroolaLogo from './FroolaLogo';
import HeroDials from './HeroDials';
import LivingLogo from './LivingLogo';
import PricingSection from './PricingSection';
import ProfileButton from './ProfileButton';
import SmileAccent from './SmileAccent';
import ThemeToggle from './ThemeToggle';

// Real songs from the lesson curriculum — the marquee shows the product's
// soul (what you actually get to play) instead of empty hero margins.
const MARQUEE_SONGS = SONG_PATH.map(s => ({ title: s.title, artist: s.artist ?? '' }));

const STEPS = [
  {
    title: 'Allow camera',
    body: 'One click. No account, no install, no setup.',
  },
  {
    title: 'Move your hands',
    body: 'Horizontal position picks the chord. Height shapes the melody.',
  },
  {
    title: 'Make music',
    body: 'Real chords, real harmony, in real time.',
  },
];

// Quiet facts strip — privacy and credibility stated once, not sold.
const FACTS = [
  'Runs entirely in your browser',
  'No video ever leaves your device',
  'Nothing to install',
  'Free to start',
];

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Cursor is hovering the band CTA — the living face perks up.
  const [bandExcited, setBandExcited] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';

  // Remember the choice so PlayShell on /play skips its own prompt and drops
  // the user straight into the instrument.
  const startPlaying = () => {
    storeInputMode('camera');
    navigate('/play');
  };

  // Scroll reveals: sections fade-rise in once as they enter the viewport.
  useScrollReveal(rootRef);

  return (
    <div className="lp4" data-theme={theme} ref={rootRef}>
      {/* Slim sticky nav: wordmark, section links, one CTA. */}
      <nav className="lp4__nav" aria-label="Main">
        <a className="lp4__nav-brand" href="#top" aria-label="Froola home">
          <FroolaLogo size={17} color={inkColor} />
        </a>
        <div className="lp4__nav-links">
          <a href="#how">How it works</a>
          <a href="#songs">Songs</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="lp4__nav-side">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ProfileButton variant="nav" />
          <button className="lp4__pill lp4__pill--nav" onClick={startPlaying}>
            Start playing
          </button>
        </div>
      </nav>

      {/* Hero: left-aligned editorial headline, then the product full width. */}
      <section className="lp4__hero lp4__hero--left" id="top">
        <div className="lp4__wrap">
          <h1 className="lp4__headline">
            Meet froola<span className="lp4__headline-dot">.</span>
          </h1>
          <SmileAccent />
          <p className="lp4__subhead">
            An instrument you play without touching anything.
            <br />
            Your camera reads your hands. Your hands make the music.
          </p>
          <div className="lp4__ctas">
            <button className="lp4__pill" onClick={startPlaying}>
              Start playing
            </button>
            <a className="lp4__link-btn" href="#how">
              How it works<span aria-hidden="true"> ›</span>
            </a>
          </div>
        </div>
        <div className="lp4__stage">
          <HeroDials />
          <p className="lp4__stage-caption">
            Left hand picks the chord. Right hand colors it.
          </p>
        </div>
      </section>

      {/* Facts strip: privacy + credibility, stated once. */}
      <div className="lp4__strip" data-reveal>
        <div className="lp4__strip-inner">
          {FACTS.map(f => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="lp4__section lp4__section--left" id="how" data-reveal>
        <div className="lp4__wrap">
          <h2 className="lp4__h2">How it works</h2>
          <ol className="lp4__steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="lp4__step">
                <span className="lp4__step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp4__step-title">{step.title}</h3>
                <p className="lp4__step-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Songs you can play */}
      <section className="lp4__songs lp4__songs--left" id="songs" data-reveal>
        <div className="lp4__wrap lp4__songs-head">
          <h2 className="lp4__h2">Real songs, from day one.</h2>
          <p className="lp4__prose">
            A guided path from your first chord to a full chorus.
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
        <div className="lp4__wrap lp4__songs-cta">
          <button className="lp4__link-btn" onClick={() => navigate('/learn')}>
            Explore the lessons
            <span aria-hidden="true"> ›</span>
          </button>
        </div>
      </section>

      <PricingSection />

      {/* Final CTA — the one playful brand moment. */}
      <div className="lp4__cta-band-wrap" data-reveal>
        <section className="lp4__cta-band">
          <LivingLogo excited={bandExcited} />
          <h2 className="lp4__h2">Ready to play?</h2>
          <p className="lp4__cta-band-sub">Free to start. Nothing to install.</p>
          <div
            className="lp4__ctas"
            onPointerEnter={() => setBandExcited(true)}
            onPointerLeave={() => setBandExcited(false)}
          >
            <button className="lp4__pill" onClick={startPlaying}>
              Start playing
            </button>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
