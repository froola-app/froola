import DocPage from './DocPage';
import { CONTACT_EMAIL } from './SiteFooter';

export default function RefundsPage() {
  return (
    <DocPage title="Refunds & Cancellation" updated="July 18, 2026">
      <p>
        This policy covers froola&rsquo;s paid subscription plans
        (&ldquo;Plus&rdquo; and &ldquo;Studio&rdquo;), billed weekly or
        monthly through Stripe.
      </p>

      <h2>Cancelling your subscription</h2>
      <p>
        You can cancel at any time from the billing portal (open your profile
        in the app, or the <a href="/pricing">pricing page</a>, and choose
        &ldquo;Manage subscription&rdquo;). Cancellation stops future
        renewals; your paid features stay active until the end of the billing
        period you already paid for. You will not be charged again after
        cancelling.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          <strong>Accidental charges and duplicates.</strong> If you were
          charged in error — a duplicate subscription, a renewal right after
          you tried to cancel, an accidental purchase — contact us and we will
          refund it.
        </li>
        <li>
          <strong>Something broken.</strong> If a paid feature did not work
          for you and we cannot fix it promptly, we will refund the affected
          period.
        </li>
        <li>
          <strong>Change of mind.</strong> Partial billing periods are not
          refunded by default — cancelling simply lets the current period run
          out. That said, if something feels unfair, write to us; we would
          rather make it right than argue over small amounts.
        </li>
      </ul>

      <h2>How to request a refund</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the
        address associated with your account, with the approximate charge date
        and amount. We aim to respond within a few business days. Approved
        refunds are returned to your original payment method by Stripe,
        typically within 5–10 business days.
      </p>

      <h2>Statutory rights</h2>
      <p>
        Nothing in this policy limits any refund or withdrawal rights you have
        under the consumer-protection laws of your place of residence.
      </p>
    </DocPage>
  );
}
