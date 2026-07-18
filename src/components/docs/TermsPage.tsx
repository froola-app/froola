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
        and hand movements. Core features are free to use without an account.
        Optional paid subscription plans (&ldquo;Plus&rdquo; and
        &ldquo;Studio&rdquo;) unlock additional features as described on our{' '}
        <a href="/pricing">pricing page</a>.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Some features require signing in with a Google account. You are
        responsible for activity that occurs under your account. You must
        provide accurate information and keep your sign-in credentials secure.
        We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <p>
        Paid plans are billed in advance on a recurring weekly or monthly
        basis through our payment processor, Stripe. Your subscription renews
        automatically until you cancel. You can cancel at any time from the
        billing portal; cancellation takes effect at the end of the current
        billing period. Prices may change with notice — continued use after a
        price change takes effect constitutes acceptance. See our{' '}
        <a href="/refunds">Refunds &amp; Cancellation policy</a> for details.
      </p>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of the music, recordings, and replays you create
        with froola. By generating a shareable replay link, you grant us the
        limited right to host and transmit that replay so the people you share
        it with can view it. You are responsible for the content you create
        and share, and it must not infringe the rights of others.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for any unlawful purpose;</li>
        <li>
          attempt to probe, disrupt, or gain unauthorized access to the
          Service or its infrastructure;
        </li>
        <li>
          resell, sublicense, or circumvent payment for paid features;
        </li>
        <li>
          scrape or copy substantial portions of the Service other than
          content you created.
        </li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>
        The Service — including its software, design, sounds, and branding —
        is owned by froola and protected by applicable intellectual-property
        laws. These Terms do not grant you any right to use the froola name or
        branding.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; without warranties of any kind, express or implied,
        including fitness for a particular purpose and non-infringement. We do
        not warrant that the Service will be uninterrupted or error-free.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, froola will not be liable for
        any indirect, incidental, special, consequential, or punitive damages,
        or any loss of data or profits, arising out of your use of the
        Service. Our total liability for any claim is limited to the amount
        you paid us in the twelve months before the claim arose, or ten US
        dollars if you paid nothing.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or
        terminate your access if you materially breach these Terms. Sections
        that by their nature should survive termination (including 4, 6, 7,
        and 8) survive.
      </p>

      <h2>10. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If a change is material,
        we will give reasonable notice (for example, on the website). Your
        continued use of the Service after changes take effect constitutes
        acceptance of the updated Terms.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of [jurisdiction], without regard
        to conflict-of-law principles.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </DocPage>
  );
}
