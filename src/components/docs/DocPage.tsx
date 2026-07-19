import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import FroolaLogo from '../brand/FroolaLogo';
import ThemeToggle from '../ThemeToggle';
import SiteFooter from './SiteFooter';

interface DocPageProps {
  title: string;
  updated?: string;
  children: ReactNode;
}

// Shared layout for legal / informational pages, styled to match the landing
// page (lp4) with the same corner-home logo and theme toggle as /pricing.
export default function DocPage({ title, updated, children }: DocPageProps) {
  const { theme, toggleTheme } = useTheme();
  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="lp4 doc" data-theme={theme}>
      <Link to="/" className="lp4__corner-home" aria-label="Froola home">
        <FroolaLogo size={16} color={inkColor} />
      </Link>
      <div className="lp4__corner">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <main className="doc__body">
        <h1>{title}</h1>
        {updated && <p className="doc__updated">Last updated: {updated}</p>}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
