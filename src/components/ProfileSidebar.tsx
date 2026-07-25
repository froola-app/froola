import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type Theme } from '../useTheme';
import { openBillingPortal } from '../billing';
import { effectivePlan, entitlementsFor } from '../entitlements';
import {
  listVideoRecordings,
  deleteVideoRecording,
  watchUrl,
  type VideoRecording,
} from '../engine/recording/videoRecordingStore';
import { copyToClipboard } from '../utils/clipboard';
import {
  getVisualTheme,
  setVisualTheme,
  VISUAL_THEMES,
  type VisualTheme,
} from '../engine/renderer/themes';
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

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function RecordingRow({ rec, onDeleted }: { rec: VideoRecording; onDeleted: () => void }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const date = new Date(rec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className="profile-drawer__row">
      <div className="profile-drawer__row-text">
        <p className="profile-drawer__row-label">
          <a href={watchUrl(rec.id)} target="_blank" rel="noreferrer">{formatDuration(rec.durationMs)} take</a>
        </p>
        <p className="profile-drawer__row-hint">{date}</p>
      </div>
      <button
        className="profile-drawer__row-btn"
        onClick={async () => {
          await copyToClipboard(watchUrl(rec.id));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button
        className="profile-drawer__row-btn"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          const ok = await deleteVideoRecording(rec);
          if (ok) onDeleted(); else setDeleting(false);
        }}
        aria-label="Delete recording"
      >
        {deleting ? '…' : 'Delete'}
      </button>
    </div>
  );
}

function RecordingsPanel({ open }: { open: boolean }) {
  const { user, authReady, profile } = useAuth();
  const ent = entitlementsFor(profile);
  // null = fetch failed / unavailable, undefined = fetching.
  const [recordings, setRecordings] = useState<VideoRecording[] | null | undefined>(undefined);

  // Refetch on every open — the record button on /play saves without going
  // through this drawer, so a cached list would lie. Until the refresh lands
  // the previous list stays up (stale-while-revalidate), which is why there's
  // no synchronous reset here.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    void listVideoRecordings().then(list => { if (!cancelled) setRecordings(list); });
    return () => { cancelled = true; };
  }, [open, user]);

  if (!authReady || !user) {
    return (
      <p className="profile-drawer__note">
        Sign in to keep your recordings and share links here.
      </p>
    );
  }
  if (recordings === undefined) return <p className="profile-drawer__note">Loading…</p>;
  if (recordings === null) return <p className="profile-drawer__note">Couldn&apos;t load recordings. Try again in a moment.</p>;

  const quota = Number.isFinite(ent.maxRecordings)
    ? `${recordings.length} of ${ent.maxRecordings} slot${ent.maxRecordings === 1 ? '' : 's'} used`
    : `${recordings.length} recording${recordings.length === 1 ? '' : 's'}`;

  return (
    <>
      <p className="profile-drawer__note">{quota}</p>
      {recordings.length === 0 && (
        <p className="profile-drawer__note">
          Nothing yet — hit Record on the play screen and your take lands here
          with a share link.
        </p>
      )}
      {recordings.map(rec => (
        <RecordingRow
          key={rec.id}
          rec={rec}
          onDeleted={() => setRecordings(list => (list ?? []).filter(r => r.id !== rec.id))}
        />
      ))}
    </>
  );
}

function LookSwatch({ visualTheme, selected, locked, onChoose }: {
  visualTheme: VisualTheme;
  selected: boolean;
  locked: boolean;
  onChoose: () => void;
}) {
  const style = {
    '--looks-note': visualTheme.noteAccent,
    '--looks-left': visualTheme.left.ring,
    '--looks-right': visualTheme.right.ring,
  } as CSSProperties;

  return (
    <button
      className={
        'profile-drawer__look' +
        (selected ? ' is-selected' : '') +
        (locked ? ' is-locked' : '')
      }
      style={style}
      onClick={onChoose}
      aria-pressed={selected}
      aria-label={`${visualTheme.label}${locked ? ', locked' : ''}`}
    >
      <span className="profile-drawer__look-art" aria-hidden="true">
        <span className="profile-drawer__look-chip profile-drawer__look-chip--left" />
        <span className="profile-drawer__look-spine" />
        <span className="profile-drawer__look-chip profile-drawer__look-chip--right" />
      </span>
      <span className="profile-drawer__look-label">{visualTheme.label}</span>
      {locked && <span className="profile-drawer__look-lock" aria-hidden="true">+</span>}
    </button>
  );
}

function LooksPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const ent = entitlementsFor(profile);
  const [selectedId, setSelectedId] = useState(() => getVisualTheme().id);

  // A subscription downgrade must bring the canvas back to the free palette
  // immediately, not leave a previously selected paid look active.
  useEffect(() => {
    if (!ent.visualThemesUnlocked && selectedId !== 'froola') {
      setVisualTheme('froola');
    }
  }, [ent.visualThemesUnlocked, selectedId]);

  // Keep the selected appearance truthful during a downgrade without a
  // second render just to mirror entitlement state. The previous paid choice
  // remains remembered in local component state for a later re-upgrade.
  const visibleSelectedId = ent.visualThemesUnlocked ? selectedId : 'froola';

  const choose = (visualTheme: VisualTheme) => {
    const locked = visualTheme.id !== 'froola' && !ent.visualThemesUnlocked;
    if (locked) return;
    setVisualTheme(visualTheme.id);
    setSelectedId(visualTheme.id);
  };

  return (
    <>
      <p className="profile-drawer__note">
        Set the color story for your wheels and hand markers.
      </p>
      <div className="profile-drawer__looks" role="group" aria-label="Instrument looks">
        {VISUAL_THEMES.map(visualTheme => {
          const locked = visualTheme.id !== 'froola' && !ent.visualThemesUnlocked;
          return (
            <LookSwatch
              key={visualTheme.id}
              visualTheme={visualTheme}
              selected={visibleSelectedId === visualTheme.id}
              locked={locked}
              onChoose={() => choose(visualTheme)}
            />
          );
        })}
      </div>
      {!ent.visualThemesUnlocked && (
        <a className="profile-drawer__looks-upgrade" href="/pricing" onClick={onClose}>
          Unlock all looks with Plus <span aria-hidden="true">→</span>
        </a>
      )}
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
            <h3 className="profile-drawer__section-title">Recordings</h3>
            <RecordingsPanel open={open} />
          </section>
          <section className="profile-drawer__section">
            <h3 className="profile-drawer__section-title">Looks</h3>
            <LooksPanel onClose={onClose} />
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
