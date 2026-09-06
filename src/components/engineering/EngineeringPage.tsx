import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '../../useScrollReveal';
import { useTheme } from '../../useTheme';
import Footer from '../Footer';
import FroolaLogo from '../FroolaLogo';
import { REPO_URL } from '../OpenSourceSection';
import ThemeToggle from '../ThemeToggle';
import {
  JITTER, LAG, SETTLING, FIST_FLIPS, SEAM_FLIPS,
  RAW_JITTER, LEGACY_CUTOFF_HZ, improvement, timesFaster,
  type Metric,
} from './benchmarks';

// Whose work this is. Kept as a constant because it is the one thing on the
// page that is about people rather than code.
const AUTHORS = 'Dennis Xue and Felicia';

const STACK = ['TypeScript', 'MediaPipe', 'Zero dependencies', 'MIT'];

type Row = { label: string; metric: Metric; note: string; render: (m: Metric) => string };

const RESULTS: Row[] = [
  {
    label: 'Shimmer while a hand is held still',
    metric: JITTER,
    note: `raw input scores ${RAW_JITTER}`,
    render: m => `${improvement(m)}% steadier`,
  },
  {
    label: 'Lag behind a hand in motion',
    metric: LAG,
    note: 'sine sweep at playing speed',
    render: m => `${improvement(m)}% quicker`,
  },
  {
    label: 'Catching up after a fast move',
    metric: SETTLING,
    note: 'time to settle within 1% of target',
    render: m => `${timesFaster(m)}x faster`,
  },
  {
    label: 'Chord lock flickering on a held hand',
    metric: FIST_FLIPS,
    note: 'state changes over 200 frames',
    render: m => `${m.before} to ${m.after}`,
  },
  {
    label: 'Hand jumping between the two wheels',
    metric: SEAM_FLIPS,
    note: 'reassignments over 200 frames',
    render: m => `${m.before} to ${m.after}`,
  },
];

const STAGES = [
  {
    title: 'Score the hand, do not judge it',
    body: `Finger curl comes out as a number from 0 to 1 instead of a yes or no. A
      boolean has to pick a threshold, and a hand resting on that threshold flips
      the answer every frame. Scoring first means the decision can be made later,
      by something with a memory.`,
  },
  {
    title: 'Decide which wheel a hand belongs to',
    body: `Position decides, never the model's own left or right label, because that
      label flickers and swaps which wheel a hand is driving mid gesture. But pure
      position has a seam: a hand resting midway between the wheels is equidistant,
      so noise picks the winner and re-picks it every frame. Last frame's answer is
      kept unless a different one wins by a real margin and keeps winning.`,
    stat: `${SEAM_FLIPS.before} reassignments became ${SEAM_FLIPS.after}`,
  },
  {
    title: 'Smooth by speed, not by a constant',
    body: `A fixed average has one time constant, so it is one frozen compromise:
      smooth enough to kill the shimmer and it drags, quick enough to keep up and
      the resting hand shivers. The One Euro filter makes the cutoff a function of
      speed, so a still hand gets heavy smoothing and a moving hand gets almost
      none. That is why both numbers improved at once, which no single cutoff can
      do.`,
    stat: `${LAG.before} ms of lag became ${LAG.after} ms`,
  },
  {
    title: 'Commit to a gesture, then stick to it',
    body: `The curl score passes through a Schmitt trigger: it takes more curl to
      close a fist than to release one, so there is no value at which the state is
      unstable. A short dwell on top rejects the single blurry frame that briefly
      looks like a fist.`,
    stat: `${FIST_FLIPS.before} flickers became ${FIST_FLIPS.after}`,
  },
  {
    title: 'Coast through a missed frame, and predict the next',
    body: `A dropped detection is not evidence that the hand moved, so the last
      position is held briefly instead of blanking. And since inference runs
      slower than the display, every drawn position describes where the hand was.
      Projecting forward along the velocity the filter already computed cancels
      most of that, for free, and costs nothing at rest where the velocity is
      zero.`,
  },
];

const LIMITS = [
  {
    title: 'Two hands on top of each other stay ambiguous',
    body: `When the gap between two hands is smaller than the landmark noise, their
      identities are not recoverable by filtering, because the input no longer
      contains them. The benchmark deliberately does not claim this one.`,
  },
  {
    title: 'Synthetic traces are not hands',
    body: `Generated traces isolate one property at a time, which is exactly what
      makes them measurable and exactly what makes them incomplete. They are a
      regression net, not a substitute for a camera and a real pair of hands.`,
  },
  {
    title: 'The tuning is specific to this scale',
    body: `Parameters are fitted to normalized screen coordinates at roughly 30 Hz.
      Ported to pixel space they would need refitting, which is why the library
      documents what to change and in which direction.`,
  },
];

export default function EngineeringPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';
  useScrollReveal(rootRef);

  return (
    <div className="lp4 eng" data-theme={theme} ref={rootRef}>
      <nav className="lp4__nav" aria-label="Main">
        <Link className="lp4__nav-brand" to="/" aria-label="Froola home">
          <FroolaLogo size={17} color={inkColor} />
        </Link>
        <div className="lp4__nav-links">
          <a href="#results">Results</a>
          <a href="#how">How it works</a>
          <a href="#limits">Limits</a>
        </div>
        <div className="lp4__nav-side">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <a className="lp4__pill lp4__pill--nav" href={REPO_URL} target="_blank" rel="noreferrer">
            Source
          </a>
        </div>
      </nav>

      {/* Header. No product hero here: this page is for someone reading the work. */}
      <header className="eng__head">
        <div className="lp4__wrap">
          <p className="eng__eyebrow">Case study</p>
          <h1 className="eng__title">Building a hand tracker that holds still.</h1>
          <p className="eng__standfirst">
            MediaPipe will tell you where twenty one points on a hand are, about thirty
            times a second. That is not the same thing as an instrument you can play.
            This is the layer in between, and what it took to make it feel solid.
          </p>
          <div className="eng__meta">
            <span className="eng__byline">{AUTHORS}</span>
            <span className="eng__dot" aria-hidden="true">·</span>
            <span>2026</span>
          </div>
          <ul className="eng__stack">
            {STACK.map(s => <li key={s}>{s}</li>)}
          </ul>
        </div>
      </header>

      {/* The problem, stated concretely enough to be checkable. */}
      <section className="eng__section">
        <div className="lp4__wrap eng__cols">
          <h2 className="eng__h2">The problem</h2>
          <div className="eng__body">
            <p>
              Raw landmarks shiver when the hand is perfectly still. They arrive late.
              They miss a frame now and then. Put a threshold anywhere near them and it
              chatters, and because a closed fist locks the current chord, that chatter
              is not a visual nit. You can hear it.
            </p>
            <p>
              The obvious fix, and the one most integrations reach for, is an
              exponential moving average. We shipped that first. It works, up to the
              point where you notice it cannot win: any setting steady enough to stop
              the shimmer also drags visibly behind a moving hand, because a fixed
              cutoff trades one against the other along a single axis.
            </p>
            <p className="eng__aside">
              The average we replaced was equivalent to a constant {LEGACY_CUTOFF_HZ} Hz
              low pass. Every number on this page is measured against it.
            </p>
          </div>
        </div>
      </section>

      {/* Results first: the part a skimmer should leave with. */}
      <section className="eng__section eng__section--tint" id="results" data-reveal>
        <div className="lp4__wrap">
          <h2 className="eng__h2">What changed</h2>
          <p className="eng__lede">
            Measured by replaying seeded synthetic traces through the real code. The
            benchmark runs in CI with no camera and no device, so a change that makes
            tracking worse fails the build.
          </p>

          <div className="eng__table" role="table" aria-label="Measured results">
            <div className="eng__tr eng__tr--head" role="row">
              <span role="columnheader">Behaviour</span>
              <span role="columnheader">Before</span>
              <span role="columnheader">After</span>
              <span role="columnheader">Change</span>
            </div>
            {RESULTS.map(r => (
              <div className="eng__tr" role="row" key={r.label}>
                <span role="cell" className="eng__cell-label">
                  {r.label}
                  <em>{r.note}</em>
                </span>
                <span role="cell" className="eng__num eng__num--before">
                  {r.metric.before}{r.metric.unit && ` ${r.metric.unit}`}
                </span>
                <span role="cell" className="eng__num eng__num--after">
                  {r.metric.after}{r.metric.unit && ` ${r.metric.unit}`}
                </span>
                <span role="cell" className="eng__delta">{r.render(r.metric)}</span>
              </div>
            ))}
          </div>
          <p className="eng__footnote">
            Shimmer and lag improved together. That pairing is the whole claim, and the
            benchmark asserts it by name so it fails loudly if the filter ever collapses
            back into a plain low pass.
          </p>
        </div>
      </section>

      {/* The reasoning, one stage per decision. */}
      <section className="eng__section" id="how">
        <div className="lp4__wrap">
          <h2 className="eng__h2">How it works</h2>
          <p className="eng__lede">
            Five stages between a landmark and a note. Each one exists because
            something specific was wrong without it.
          </p>
          <ol className="eng__rail">
            {STAGES.map((s, i) => (
              <li className="eng__stage" key={s.title}>
                <span className="eng__stage-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="eng__stage-body">
                  <h3 className="eng__stage-title">{s.title}</h3>
                  <p>{s.body}</p>
                  {s.stat && <p className="eng__stage-stat">{s.stat}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How it is built. Short, because the point is the shape, not the detail. */}
      <section className="eng__section eng__section--tint">
        <div className="lp4__wrap eng__cols">
          <h2 className="eng__h2">Built to be testable</h2>
          <div className="eng__body">
            <p>
              All of it lives in a package with no dependencies that never imports
              MediaPipe, touches the DOM, or knows what a camera is. It takes landmarks
              and a timestamp and returns what the hands are doing.
            </p>
            <p>
              That constraint is what makes the numbers on this page possible. Camera
              code cannot be tested in CI, so the split was drawn exactly at the line
              where the browser stops being necessary. Everything on the far side of it
              runs headless, in milliseconds, on every commit.
            </p>
            <pre className="eng__code"><code>{`npm install
npm run dev     # the instrument
npm test        # the tracker
npm run bench   # regenerates the numbers above`}</code></pre>
          </div>
        </div>
      </section>

      {/* Limits. A case study without these is a brochure. */}
      <section className="eng__section" id="limits">
        <div className="lp4__wrap">
          <h2 className="eng__h2">What it does not do</h2>
          <div className="eng__limits">
            {LIMITS.map(l => (
              <div className="eng__limit" key={l.title}>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="eng__cta">
        <div className="lp4__wrap">
          <h2 className="eng__h2">Have a look</h2>
          <p className="eng__lede">
            The tracker is a library you can drop into your own project, and froola is
            the instrument built on it. Both are MIT.
          </p>
          <div className="eng__cta-row">
            <Link className="lp4__pill" to="/play">Try the instrument</Link>
            <a className="lp4__link-btn" href={`${REPO_URL}/tree/main/packages/handtrack`}
               target="_blank" rel="noreferrer">
              Read the tracker<span aria-hidden="true"> ›</span>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
