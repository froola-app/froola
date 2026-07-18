import LegalShell from './LegalShell';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

// Every claim on this page must match what the code actually does. If a
// data practice changes, this page changes in the same PR.
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 18, 2026">
      <p>
        froola is an instrument you play with your hands in front of a camera. That only
        works if you can trust what happens to the camera feed. This policy explains what
        we collect, what we never collect, and where everything lives.
      </p>

      <h2>Your camera stays on your device</h2>
      <p>
        Hand tracking runs entirely in your browser, on your device. The video from your
        camera is processed locally, frame by frame, and is never uploaded, streamed, or
        stored by froola. No server ever sees it. When you leave the page or turn the
        camera off, the feed ends.
      </p>

      <h2>Recordings you choose to make</h2>
      <p>
        If you record a performance and save it, that video is uploaded to our storage so
        you can watch it later and share it with a link.
      </p>
      <ul>
        <li>Recordings exist only when you press record. Nothing is captured in the background.</li>
        <li>
          Share links are unlisted. Anyone with the link can watch, but recordings are not
          published anywhere or searchable.
        </li>
        <li>
          You can delete a recording at any time. Deleting removes the video and breaks its
          share link.
        </li>
        <li>Recording limits per plan are described on the pricing page.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        You can play froola without an account. If you sign in, with Google or an email
        sign-in link, we store your email address, your name and profile photo if your
        sign-in provider shares them, your onboarding choices and lesson progress, and
        your plan.
      </p>

      <h2>Payments</h2>
      <p>
        Paid plans are processed by Stripe. Your card details go directly to Stripe and
        never touch froola. We keep only what a subscription needs to run: a customer
        reference and your plan status. Stripe's own privacy policy governs how they
        handle payment data.
      </p>

      <h2>What we don't do</h2>
      <ul>
        <li>No analytics scripts and no ad trackers.</li>
        <li>No third-party cookies.</li>
        <li>No selling or renting your data, to anyone, ever.</li>
      </ul>

      <h2>On your device</h2>
      <p>
        froola keeps a few preferences in your browser, such as your theme, tutorial
        progress, and input choice. They stay on your device and are not sent to us.
      </p>

      <h2>Who we work with</h2>
      <p>
        Three service providers run froola: Supabase for accounts, profiles, and
        recordings, Stripe for payments, and Vercel for hosting. Each processes data only
        to provide its service to us.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete recordings yourself at any time. To delete your account and
        everything attached to it, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and
        we'll take care of it.
      </p>

      <h2>Children</h2>
      <p>
        froola is built so that playing never sends video anywhere, which makes it safe to
        try at any age. If you're under the age where your country requires parental
        consent for online accounts, ask a parent or guardian before creating one.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, we'll update this page and the date at the top. Meaningful
        changes get called out, not buried.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
