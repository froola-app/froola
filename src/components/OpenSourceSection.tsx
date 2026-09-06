import { Link } from 'react-router-dom';
import SmileAccent from './SmileAccent';

export const REPO_URL = 'https://github.com/froola-app/froola';

// What the engine actually is, said plainly. This section replaced the pricing
// table when froola went open source, so it sits in the same spot on the page
// and answers the same question: what do I get, and what does it cost me.
const PIECES = [
  {
    title: 'Hand tracking',
    body: 'A dependency-free tracker that turns shivering landmarks into signals steady enough to play.',
  },
  {
    title: 'Music',
    body: 'Keys, scales, chord voicings, and the gesture-to-chord mapping.',
  },
  {
    title: 'Audio',
    body: 'A Web Audio synth and sampler with its own tempo clock, looper, and arpeggiator.',
  },
  {
    title: 'Renderer',
    body: 'Canvas 2D dials, hand markers, and particles, driven off the same frame loop.',
  },
];

export default function OpenSourceSection() {
  return (
    <section className="lp4__section lp4__section--left lp4__os" id="open-source" data-reveal>
      <div className="lp4__wrap">
        <h2 className="lp4__h2">Free, forever, and open.</h2>
        <SmileAccent />
        <p className="lp4__prose">
          Every feature is on for everyone. No plans, no trial, no account needed to play.
          The whole thing is on GitHub under the MIT license: the instrument, the engine
          behind it, and the tests that keep it honest.
        </p>

        <div className="lp4__os-grid">
          {PIECES.map(piece => (
            <div className="lp4__os-card" key={piece.title}>
              <h3 className="lp4__os-card-title">{piece.title}</h3>
              <p className="lp4__os-card-body">{piece.body}</p>
            </div>
          ))}
        </div>

        <div className="lp4__os-run">
          <p className="lp4__os-run-label">Run it yourself</p>
          <pre className="lp4__os-code">
            <code>
              git clone {REPO_URL}.git{'\n'}
              cd froola{'\n'}
              npm install{'\n'}
              npm run dev
            </code>
          </pre>
          <p className="lp4__os-run-note">
            No API keys, no database, no config. It just runs.
          </p>
        </div>

        <div className="lp4__ctas lp4__os-ctas">
          <Link className="lp4__link-btn" to="/engineering">
            How the hand tracking works<span aria-hidden="true"> ›</span>
          </Link>
          <a className="lp4__link-btn" href={REPO_URL} target="_blank" rel="noreferrer">
            View the source<span aria-hidden="true"> ›</span>
          </a>
        </div>
      </div>
    </section>
  );
}
