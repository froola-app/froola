import { Link } from 'react-router-dom';
import DocPage from './DocPage';
import { CONTACT_EMAIL } from './SiteFooter';

export default function AboutPage() {
  return (
    <DocPage title="About froola">
      <p>
        froola is a musical instrument that lives in your browser and is
        played with your hands in the air. Point your camera at yourself, move
        your hands around two on-screen dials, and you are playing real chords
        and melodies — no instrument, no downloads, no music theory required.
      </p>

      <h2>Why we built it</h2>
      <p>
        Most people never get to feel what it is like to play music. The
        instrument is expensive, the learning curve is steep, and the first
        year sounds terrible. froola flips that: every hand position sounds
        good by design, so the joy comes first and the theory can follow. Our
        <Link to="/learn"> song lessons</Link> then teach you real songs and
        real harmony on top of that foundation.
      </p>

      <h2>How it works</h2>
      <p>
        Your left hand picks the chord, your right hand adds color, and height
        controls the register. Hand tracking runs entirely on your device
        using MediaPipe — no video ever leaves your browser (see our{' '}
        <Link to="/privacy">Privacy Policy</Link>). The sound engine is built
        on the Web Audio API, tuned so that a beginner&rsquo;s first wave of
        the hand already sounds like music.
      </p>

      <h2>Get in touch</h2>
      <p>
        Questions, ideas, or songs you want us to add? We read everything:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </DocPage>
  );
}
