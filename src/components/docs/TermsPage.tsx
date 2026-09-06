import DocPage from './DocPage';
import { CONTACT_EMAIL } from './SiteFooter';

export default function TermsPage() {
  return (
    <DocPage title="Terms of Service" updated="July 18, 2026">
      <p>
        Welcome to froola. These Terms of Service (&ldquo;Terms&rdquo;) govern
        your use of the froola web application and website at{' '}
        <a href="https://froolamusic.com">froolamusic.com</a> (the
        &ldquo;Service&rdquo;), operated by froola (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By using the Service you agree to these Terms. If
        you do not agree, do not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        froola is a browser-based musical instrument controlled by your camera
        and hand movements. Every feature is free, for everyone, with no account
        required. There are no paid plans and nothing is held back. The source is
        published under the MIT license, so you are also free to read it, run it
        yourself, and build on it.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Some features require signing in with a Google account. You are
        responsible for activity that occurs under your account. You must
        provide accurate information and keep your sign-in credentials secure.
        We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of the music, recordings, and replays you create
        with froola. By generating a shareable replay link, you grant us the
        limited right to host and transmit that replay so the people you share
        it with can view it. You are responsible for the content you create
        and share, and it must not infringe the rights of others.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for any unlawful purpose;</li>
        <li>
          attempt to probe, disrupt, or gain unauthorized access to the
          Service or its infrastructure;
        </li>
        <li>
          scrape or copy substantial portions of the Service other than
          content you created.
        </li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        The Service — including its software, design, sounds, and branding —
        is owned by froola and protected by applicable intellectual-property
        laws. These Terms do not grant you any right to use the froola name or
        branding.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; without warranties of any kind, express or implied,
        including fitness for a particular purpose and non-infringement. We do
        not warrant that the Service will be uninterrupted or error-free.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, froola will not be liable for
        any indirect, incidental, special, consequential, or punitive damages,
        or any loss of data or profits, arising out of your use of the
        Service. Since froola is free and takes no payments, our total
        liability for any claim is limited to ten US dollars.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or
        terminate your access if you materially breach these Terms. Sections
        that by their nature should survive termination (including 4, 6, 7,
        and 8) survive.
      </p>

      <h2>9. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If a change is material,
        we will give reasonable notice (for example, on the website). Your
        continued use of the Service after changes take effect constitutes
        acceptance of the updated Terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </DocPage>
  );
}
