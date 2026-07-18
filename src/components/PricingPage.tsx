import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTheme } from '../hooks/useTheme';
import CheckoutResult from './CheckoutResult';
import FroolaLogo from './FroolaLogo';
import PricingSection from './PricingSection';
import ProfileButton from './ProfileButton';
import ThemeToggle from './ThemeToggle';
import SiteFooter from './docs/SiteFooter';

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
      <CheckoutResult />

      <SiteFooter />
    </div>
  );
}
