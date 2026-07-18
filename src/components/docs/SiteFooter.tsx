import { Link } from 'react-router-dom';

export const CONTACT_EMAIL = 'supportfroola@gmail.com';

// Shared multi-column site footer — landing page and every doc page render
// this so the legal links Stripe requires are reachable from anywhere.
export default function SiteFooter() {
  return (
    <footer className="lp4__footer">
      <div className="sf">
        <div className="sf__brand">froola</div>
        <div className="sf__cols">
          <nav className="sf__col" aria-label="Product">
            <h3>Product</h3>
            <Link to="/play">Play</Link>
            <Link to="/learn">Learn</Link>
            <Link to="/pricing">Pricing</Link>
          </nav>
          <nav className="sf__col" aria-label="Resources">
            <h3>Resources</h3>
            <Link to="/about">About</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Problem%20report`}>
              Report a problem
            </a>
          </nav>
          <nav className="sf__col" aria-label="Legal and trust">
            <h3>Legal &amp; Trust</h3>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/refunds">Refunds &amp; Cancellation</Link>
          </nav>
        </div>
        <div className="sf__bottom">
          <span>© 2026 froola. All rights reserved.</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}
