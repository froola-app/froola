import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type Theme } from '../useTheme';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import FroolaLogo from './FroolaLogo';

// Play-screen actions the Settings tab can offer. Optional so the drawer
// stays portable — mount it on a screen without these and the rows
// simply don't render.
export interface PlayActions {
  inputMode: 'camera' | 'mouse';
  onSwitchInput: () => void;
  onReplayTutorial: () => void;
}

// Adding a tab = one entry here + a case in TabPanel below.
const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function GoogleButton({ onDone }: { onDone?: () => void }) {
  const { signInWithGoogle } = useAuth();
  return (
    <button
      className="signin-prompt__google"
      onClick={() => {
        signInWithGoogle()
          .then(() => onDone?.())
          .catch(() => { /* popup blocked or closed — button stays for retry */ });
      }}
    >
      <img src="/google-logo.svg" alt="" width={16} height={16} />
      Continue with Google
    </button>
  );
}

type EmailSignInStatus = 'idle' | 'sending' | 'sent';

function EmailSignIn() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<EmailSignInStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  if (status === 'sent') {
    return (
      <p className="signin-prompt__email-sent">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form
      className="signin-prompt__email-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setStatus('sending');
        signInWithEmail(email)
          .then(() => setStatus('sent'))
          .catch(() => {
            setStatus('idle');
            setError("Couldn't send the link. Try again.");
          });
      }}
    >
      <input
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        value={email}
        disabled={status === 'sending'}
        onChange={(e) => setEmail(e.target.value)}
        className="signin-prompt__email-input"
      />
      <button
        type="submit"
        className="signin-prompt__email-submit"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {error && <p className="signin-prompt__email-error">{error}</p>}
    </form>
  );
}

function DrawerHeader({ onClose, theme }: { onClose: () => void; theme: Theme }) {
  const { user, authReady } = useAuth();
  return (
    <header className="profile-drawer__header">
      <div className="profile-drawer__identity">
        {authReady || user
          ? <Avatar size={48} />
          : <FroolaLogo size={44} color={theme === 'dark' ? '#FAFAF8' : '#111111'} />}
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

function ProfilePanel() {
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
      <p className="profile-drawer__note">
        Your photo and name come from your Google account. Custom photos are on the way.
      </p>
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
      <SettingsRow label="Theme" hint="Landing and pricing pages">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </SettingsRow>
      {play && (
        <>
          <SettingsRow
            label="Input"
            hint={play.inputMode === 'camera' ? 'Hands on camera' : 'Mouse or touch'}
          >
            <button
              className="profile-drawer__row-btn"
              onClick={() => { play.onSwitchInput(); onClose(); }}
            >
              {play.inputMode === 'camera' ? 'Use mouse' : 'Try camera'}
            </button>
          </SettingsRow>
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

function TabPanel({ tab, play, onClose, theme, onToggleTheme }: {
  tab: TabId;
  play?: PlayActions;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  switch (tab) {
    case 'profile': return <ProfilePanel />;
    case 'settings':
      return <SettingsPanel play={play} onClose={onClose} theme={theme} onToggleTheme={onToggleTheme} />;
  }
}

export default function ProfileSidebar({ open, onClose, play }: {
  open: boolean;
  onClose: () => void;
  play?: PlayActions;
}) {
  const [tab, setTab] = useState<TabId>('profile');
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
        <nav className="profile-drawer__tabs" role="tablist" aria-label="Sidebar sections">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={'profile-drawer__tab' + (tab === t.id ? ' is-active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="profile-drawer__panel" role="tabpanel">
          <TabPanel tab={tab} play={play} onClose={onClose} theme={theme} onToggleTheme={toggleTheme} />
        </div>
      </aside>
    </>,
    document.body,
  );
}
