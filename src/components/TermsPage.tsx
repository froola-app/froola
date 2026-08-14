import LegalShell from './LegalShell';
import { REPO_URL } from './OpenSourceSection';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="August 13, 2026">
      <p>
        These terms are the agreement between you and froola when you use the froola
        website and instrument. They're short on purpose. Please read them.
      </p>

      <h2>Using froola</h2>
      <p>
        froola is a browser instrument: your camera reads your hands and your hands make
        the music. Every feature is free, and you can play without an account. Signing in
        only saves your recordings and lesson progress across devices. Use froola only in
        ways that are legal and that don't harm the service or other people.
      </p>

      <h2>Your account</h2>
      <p>
        Signing in works through Google or an email sign-in link, so anyone with access to
        your email inbox can access your froola account. Keep that inbox secure, give us
        accurate information, and email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you believe your
        account has been compromised.
      </p>

      <h2>Nothing to pay</h2>
      <p>
        froola is free and open source. There are no plans, no subscriptions, and nothing
        to cancel. We don't take payment information at all.
      </p>

      <h2>Your recordings</h2>
      <p>
        Recordings you make are yours. Saving one gives froola permission to store it and
        stream it to people you share the link with; that permission ends when you delete
        the recording. Don't record or share content that is unlawful or that you don't
        have the right to perform. We may remove recordings that break these terms.
      </p>

      <h2>froola's content</h2>
      <p>
        The froola source code is released under the MIT license and lives at{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL}</a>; that license,
        not this page, governs what you may do with the code. The froola name and brand
        mark stay ours. Lessons teach chords and technique in the style of well-known
        songs; the songs themselves remain the property of their rights holders.
      </p>

      <h2>The service, as is</h2>
      <p>
        froola is provided as is. We work to keep it available and working well, but we
        can't promise it will always be uninterrupted or error-free. To the extent the law
        allows, froola isn't liable for damages arising from using the service. If you run
        your own copy of the code, the MIT license's warranty disclaimer applies to it.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using froola or ask us to delete your account at any time. We may
        suspend or close accounts that break these terms.
      </p>

      <h2>Changes</h2>
      <p>If these terms change, we'll update this page and the date at the top.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
