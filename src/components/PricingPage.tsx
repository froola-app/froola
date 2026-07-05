import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '../useScrollReveal';
import { useTheme } from '../useTheme';
import FroolaLogo from './FroolaLogo';
import PricingSection from './PricingSection';
import ProfileButton from './ProfileButton';
import ThemeToggle from './ThemeToggle';

const CONTACT_EMAIL = 'supportfroola@gmail.com';

// Standalone /pricing route, styled to match the landing page (lp4) so
// it reads as a real page rather than an onboarding step.
export default function PricingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);
  const { theme, toggleTheme } = useTheme();
  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';

  return (
    <div className="lp4" data-theme={theme} ref={rootRef}>
      {/* Floating corner controls, matching the landing page — no nav bar.
          The logo stays as the way back home. */}
      <Link to="/" className="lp4__corner-home" aria-label="Froola home">
        <FroolaLogo size={16} color={inkColor} />
      </Link>
      <div className="lp4__corner">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <ProfileButton variant="nav" />
      </div>

      <PricingSection />

      <footer className="lp4__footer">
        <div className="lp4__footer-inner">
          <span>
            Questions or ideas?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
          <span>froola © 2026</span>
        </div>
      </footer>
    </div>
  );
}
