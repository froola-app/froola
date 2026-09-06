import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProfileButton from './account/ProfileButton';
import FroolaLogo from './brand/FroolaLogo';
import ThemeToggle from './ThemeToggle';
import { REPO_URL } from './OpenSourceSection';

/** In-page anchors for the current page, shown before the site-wide links. */
export type NavSection = { href: string; label: string };

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  /** Page-local anchors, e.g. the case study's own sections. */
  sections?: NavSection[];
  /** Landing only: the hero owns the first screen, so start transparent. */
  transparentAtTop?: boolean;
  /** The landing is already home; skip the redundant link there. */
  showProfile?: boolean;
};

// One nav for every page that isn't the instrument itself.
//
// It exists because the case study was previously reachable only by scrolling
// most of the landing page and noticing one link inside a section. Anything a
// visitor is meant to find should be reachable from the top of any page, and
// having a single component means the destinations cannot drift apart between
// the landing page and the docs.
export default function SiteNav({
  theme, onToggleTheme, sections = [], transparentAtTop = false, showProfile = true,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Only meaningful when transparentAtTop: tracks whether the hero has been
  // scrolled past, so the bar can fade its background in instead of sitting
  // as a hard edge across the hero.
  const [stuck, setStuck] = useState(!transparentAtTop);

  useEffect(() => {
    if (!transparentAtTop) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setStuck(true); return; }
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [transparentAtTop]);

  const inkColor = theme === 'dark' ? '#FAFAF8' : '#111111';

  return (
    <>
      <div ref={sentinelRef} className="site-nav__sentinel" aria-hidden="true" />
      <nav className={`site-nav${stuck ? ' is-stuck' : ''}`} aria-label="Main">
        <Link className="site-nav__brand" to="/" aria-label="Froola home">
          <FroolaLogo size={17} color={inkColor} />
        </Link>
        <div className="site-nav__links">
          {sections.map(s => (
            <a key={s.href} href={s.href}>{s.label}</a>
          ))}
          {sections.length > 0 && <span className="site-nav__sep" aria-hidden="true" />}
          <Link to="/play">Play</Link>
          <Link to="/learn">Learn</Link>
          <Link to="/engineering">Hand tracking</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="site-nav__side">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {showProfile && <ProfileButton variant="nav" />}
        </div>
      </nav>
    </>
  );
}
