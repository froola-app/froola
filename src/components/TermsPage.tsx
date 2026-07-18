import LegalShell from './LegalShell';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="July 18, 2026">
      <p>
        These terms are the agreement between you and froola when you use the froola
        website and instrument. They're short on purpose. Please read them.
      </p>

      <h2>Using froola</h2>
      <p>
        froola is a browser instrument: your camera reads your hands and your hands make
        the music. You can play free without an account. Some features require an account
        or a paid plan. Use froola only in ways that are legal and that don't harm the
        service or other people.
      </p>

      <h2>Your account</h2>
      <p>
        Signing in works through Google or an email sign-in link, so anyone with access to
        your email inbox can access your froola account. Keep that inbox secure, give us
        accurate information, and email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you believe your
        account has been compromised.
      </p>

      <h2>Plans, billing, and cancellation</h2>
      <p>
        Paid plans are billed weekly or monthly through Stripe and renew automatically
        until cancelled. You can cancel at any time from your billing settings; your plan
        stays active until the end of the period you've paid for. If the price of a plan
        you're on changes, we'll tell you before you're charged the new amount.
      </p>

      <h2>Refunds</h2>
      <p>
        Because plans can be cancelled at any time, payments are generally not refundable,
        except where the law requires otherwise. If something went wrong with a charge,
        email us and we'll make it right.
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
        The froola product, including its design, lessons, code, and brand, belongs to
        froola. Lessons teach chords and technique; the songs they reference remain the
        property of their rights holders.
      </p>

      <h2>The service, as is</h2>
      <p>
        froola is provided as is. We work to keep it available and working well, but we
        can't promise it will always be uninterrupted or error-free. To the extent the law
        allows, froola isn't liable for indirect damages from using the service, and our
        total liability is limited to what you've paid us in the past twelve months.
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
