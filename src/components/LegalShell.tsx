import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../useTheme';
import Footer from './Footer';
import FroolaLogo from './FroolaLogo';
import ThemeToggle from './ThemeToggle';

// Shared frame for /privacy and /terms: corner chrome like /pricing, a
// narrow reading column, the shared footer.
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';

  // These pages are reached from footers at the bottom of long pages; the
  // router keeps the old scroll position, so reset it.
  useEffect(() => window.scrollTo(0, 0), []);

  return (
    <div className="lp4" data-theme={theme}>
      <Link to="/" className="lp4__corner-home" aria-label="Froola home">
        <FroolaLogo size={16} color={inkColor} />
      </Link>
      <div className="lp4__corner">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <main className="lp4__legal">
        <h1 className="lp4__legal-title">{title}</h1>
        <p className="lp4__legal-updated">Last updated {updated}</p>
        {children}
      </main>
      <Footer />
    </div>
  );
}
