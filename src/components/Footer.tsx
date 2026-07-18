import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

// Route links go through the router; hash links are plain anchors so the
// browser handles the scroll (same-document when already on `/`).
type FooterLink = { label: string; to?: string; href?: string };

const COLUMNS: { head: string; links: FooterLink[] }[] = [
  {
    head: 'Product',
    links: [
      { label: 'Start playing', to: '/play' },
      { label: 'How it works', href: '/#how' },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
  {
    head: 'Learn',
    links: [
      { label: 'Lessons', to: '/learn' },
      { label: 'Song path', href: '/#songs' },
    ],
  },
  {
    head: 'Support',
    links: [
      { label: 'Contact us', href: `mailto:${CONTACT_EMAIL}` },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Use', to: '/terms' },
    ],
  },
];

// Shared sitemap footer for marketing-style pages (landing, pricing, legal).
// Play/learn shells stay chrome-free.
export default function Footer() {
  return (
    <footer className="lp4__footer">
      <div className="lp4__footer-inner">
        <nav className="lp4__footer-cols" aria-label="Footer">
          {COLUMNS.map(col => (
            <div className="lp4__footer-col" key={col.head}>
              <h3>{col.head}</h3>
              <ul>
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.to ? <Link to={l.to}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="lp4__footer-legal">
          <span className="lp4__footer-byline">Built by two high school students.</span>
          <div className="lp4__footer-legal-row">
            <span>froola © 2026</span>
            <nav aria-label="Legal">
              <Link to="/privacy">Privacy Policy</Link>
              <span className="lp4__footer-sep" aria-hidden="true">
                |
              </span>
              <Link to="/terms">Terms of Use</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
