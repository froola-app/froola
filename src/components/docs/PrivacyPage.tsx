import DocPage from './DocPage';
import { CONTACT_EMAIL } from './SiteFooter';

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy Policy" updated="July 18, 2026">
      <p>
        This policy explains what information froola (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects when you use{' '}
        <a href="https://froolamusic.com">froolamusic.com</a>, and what we do
        with it. The short version: your camera never leaves your device, and
        we collect only what we need to run accounts and billing.
      </p>

      <h2>Your camera stays on your device</h2>
      <p>
        froola uses your camera to track your hand movements. All hand
        tracking runs locally in your browser using MediaPipe.{' '}
        <strong>
          No video, image, or camera data is ever transmitted to our servers
          or to anyone else.
        </strong>{' '}
        The camera feed exists only in your browser while you play, and camera
        access stops when you leave the instrument.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> If you sign in with Google, we
          receive your name, email address, and profile picture through our
          authentication provider, Supabase. We also store your onboarding
          answers (for example, whether you identified as a casual player,
          creator, or learner).
        </li>
        <li>
          <strong>Recordings and replays.</strong> A froola recording is
          gesture and chord data — not video and not audio of your
          surroundings. If you are signed in and save or share a recording,
          that gesture data is stored in our database so your share link
          works. Signed-out share links encode the replay in the link itself
          and store nothing on our servers. MP3 exports are saved locally in
          your own browser&rsquo;s storage, not uploaded.
        </li>
        <li>
          <strong>Billing information.</strong> Subscriptions are processed by
          Stripe. Your card details go directly to Stripe and never touch our
          servers; we store only your subscription status and plan.
        </li>
      </ul>

      <h2>What we don&rsquo;t collect</h2>
      <ul>
        <li>No video or images from your camera.</li>
        <li>No audio from your microphone.</li>
        <li>No selling of personal data to anyone, ever.</li>
        <li>No third-party advertising trackers.</li>
      </ul>

      <h2>How we use your information</h2>
      <p>
        We use the information above to operate the Service: signing you in,
        remembering your preferences, hosting your shared replays, processing
        subscription payments, and responding when you contact support. We do
        not use your data for advertising.
      </p>

      <h2>Service providers</h2>
      <p>We rely on a small number of processors to run froola:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication and database (account
          profile, saved recordings).
        </li>
        <li>
          <strong>Google</strong> — sign-in identity provider.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing.
        </li>
        <li>
          <strong>Vercel</strong> — website hosting.
        </li>
      </ul>
      <p>
        Each processor receives only the data it needs to perform its
        function, and each is bound by its own privacy commitments.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your account data for as long as your account exists. You can
        delete individual recordings from within the app. To delete your
        account and all associated data, email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
        remove it.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access,
        correct, export, or delete the personal data we hold about you.
        Contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
        honor your request.
      </p>

      <h2>Children</h2>
      <p>
        froola is fun for all ages, but accounts and purchases are intended
        for users aged 13 and over (or the age of digital consent in your
        region). We do not knowingly collect personal data from children under
        that age.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes to this policy, we will post the updated
        version here and update the date at the top.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions? Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </DocPage>
  );
}
