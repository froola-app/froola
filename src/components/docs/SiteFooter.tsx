import { Link } from 'react-router-dom';
import { REPO_URL } from '../OpenSourceSection';

export const CONTACT_EMAIL = 'supportfroola@gmail.com';

// Shared multi-column site footer — the landing page and every doc page render
// this, so it is the one place a visitor can always navigate from. There is
// nothing to sell, so the column that used to hold Pricing and the refund
// policy now points at the source and the engineering write-up instead.
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
            <Link to="/about">About</Link>
          </nav>
          <nav className="sf__col" aria-label="Open source">
            <h3>Open source</h3>
            <Link to="/engineering">Hand tracking</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              MIT license
            </a>
            <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
              Contributing
            </a>
          </nav>
          <nav className="sf__col" aria-label="Contact and legal">
            <h3>Contact &amp; Legal</h3>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Problem%20report`}>
              Report a problem
            </a>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
        </div>
        <div className="sf__bottom">
          <span>© 2026 froola. MIT licensed, free forever.</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}
