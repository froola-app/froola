import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type Theme } from '../useTheme';
import { openBillingPortal } from '../billing';
import { effectivePlan } from '../entitlements';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import FroolaLogo from './FroolaLogo';
import { GoogleButton, EmailSignIn } from './AuthMethods';

const PLAN_LABEL: Record<string, string> = { free: 'Free', plus: 'Plus', studio: 'Studio' };

// Play-screen actions the Settings tab can offer. Optional so the drawer
// stays portable — mount it on a screen without these and the rows
// simply don't render.
export interface PlayActions {
  onReplayTutorial: () => void;
}

function DrawerHeader({ onClose, theme }: { onClose: () => void; theme: Theme }) {
  const { user, authReady } = useAuth();
  return (
    <header className="profile-drawer__header">
      <div className="profile-drawer__identity">
        {authReady || user
          ? <Avatar size={40} />
          : <FroolaLogo size={36} color={theme === 'dark' ? '#FAFAF8' : '#111111'} />}
        <div className="profile-drawer__who">
          {user ? (
            <>
              <p className="profile-drawer__name">{user.displayName ?? 'Account'}</p>
              {user.email && <p className="profile-drawer__email">{user.email}</p>}
            </>
          ) : (
            <>
              <p className="profile-drawer__name">{authReady ? 'Not signed in' : 'froola'}</p>
              <p className="profile-drawer__email profile-drawer__email--wrap">
                {authReady ? 'Progress stays on this device' : 'play it by hand'}
              </p>
            </>
          )}
        </div>
        <button className="profile-drawer__close" onClick={onClose} aria-label="Close sidebar">
          ×
        </button>
      </div>
      {authReady && !user && (
        <>
          <GoogleButton />
          <div className="signin-prompt__divider">or</div>
          <EmailSignIn />
        </>
      )}
    </header>
  );
}

function SettingsRow({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="profile-drawer__row">
      <div className="profile-drawer__row-text">
        <p className="profile-drawer__row-label">{label}</p>
        {hint && <p className="profile-drawer__row-hint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PlanRow({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [pending, setPending] = useState(false);
  const plan = effectivePlan(profile);

  if (profile?.betaTester) {
    return <SettingsRow label="Plan" hint="Studio (beta)">{null}</SettingsRow>;
  }

  if (plan === 'free') {
    return (
      <SettingsRow label="Plan" hint="Free">
        <Link className="profile-drawer__row-btn" to="/pricing" onClick={onClose}>
          Upgrade
        </Link>
      </SettingsRow>
    );
  }

  return (
    <SettingsRow label="Plan" hint={PLAN_LABEL[plan] ?? plan}>
      <button
        className="profile-drawer__row-btn"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void openBillingPortal().finally(() => setPending(false));
        }}
      >
        {pending ? 'Loading…' : 'Manage billing'}
      </button>
    </SettingsRow>
  );
}

function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { user, authReady, signOutUser } = useAuth();
  if (!authReady) {
    return (
      <p className="profile-drawer__note">
        Accounts are coming soon. Everything you play stays on this device for now.
      </p>
    );
  }
  if (!user) {
    return (
      <p className="profile-drawer__note">
        Sign in to keep your lesson progress and settings with you on any device.
      </p>
    );
  }
  return (
    <>
      <PlanRow onClose={onClose} />
      <SettingsRow label="Signed in" hint={user.email ?? undefined}>
        <button className="profile-drawer__row-btn" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </SettingsRow>
    </>
  );
}

function SettingsPanel({ play, onClose, theme, onToggleTheme }: {
  play?: PlayActions;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <>
      <SettingsRow label="Theme">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </SettingsRow>
      {play && (
        <>
          <SettingsRow label="Beginner tutorial" hint="Bring back the intro tips">
            <button
              className="profile-drawer__row-btn"
              onClick={() => { play.onReplayTutorial(); onClose(); }}
            >
              Replay
            </button>
          </SettingsRow>
        </>
      )}
    </>
  );
}

export default function ProfileSidebar({ open, onClose, play }: {
  open: boolean;
  onClose: () => void;
  play?: PlayActions;
}) {
  const { theme, toggleTheme } = useTheme();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Portal to <body>: hosts like the landing nav carry backdrop-filter,
  // which turns them into the containing block for fixed descendants and
  // would pin (and clip) the drawer to the nav bar.
  return createPortal(
    <>
      <div
        className={'profile-drawer-scrim' + (open ? ' is-open' : '')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={'profile-drawer' + (open ? ' is-open' : '')}
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-label="Account and settings"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      >
        <DrawerHeader onClose={onClose} theme={theme} />
        <div className="profile-drawer__panel">
          <section className="profile-drawer__section">
            <h3 className="profile-drawer__section-title">Account</h3>
            <ProfilePanel onClose={onClose} />
          </section>
          <section className="profile-drawer__section">
            <h3 className="profile-drawer__section-title">Settings</h3>
            <SettingsPanel play={play} onClose={onClose} theme={theme} onToggleTheme={toggleTheme} />
          </section>
        </div>
      </aside>
    </>,
    document.body,
  );
}
