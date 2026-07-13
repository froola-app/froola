import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { entitlementsFor } from '../entitlements';
import { useTheme } from '../useTheme';
import { getMySong, saveMySong, deleteMySong, parseSheet, type MySong } from '../engine/songsheet';
import { listLoops, type SavedLoop } from '../engine/looper';
import SheetOverlay from './SheetOverlay';

// The one-song Plus+ feature: paste lyrics+chords once, keep it forever,
// and snapshot the current loop library alongside it. Reuses the
// .profile-drawer glass chrome (see App.css) for a consistent look with
// the account/settings drawer, but is its own top-level portal — PlayShell
// mounts it directly, not nested under ProfileSidebar.
export default function MySongPanel({
  open,
  onClose,
  onLoadLoop,
}: {
  open: boolean;
  onClose: () => void;
  onLoadLoop: (loop: SavedLoop) => void;
}) {
  const { profile } = useAuth();
  const ent = entitlementsFor(profile);
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [song, setSong] = useState<MySong | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getMySong().then(s => {
      if (cancelled) return;
      setSong(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  async function handleImport() {
    if (!title.trim() || !source.trim()) return;
    const ok = await saveMySong({ title, sheetSource: source, loops: [] });
    if (ok) {
      setSong({ title, sheetSource: source, loops: [], updatedAt: Date.now() });
      setTitle('');
      setSource('');
    }
  }

  async function handleStoreLoops() {
    if (!song) return;
    const loops = listLoops();
    const ok = await saveMySong({ title: song.title, sheetSource: song.sheetSource, loops });
    if (ok) setSong({ ...song, loops, updatedAt: Date.now() });
  }

  async function handleDelete() {
    if (!window.confirm('Delete your song? This frees your one import.')) return;
    const ok = await deleteMySong();
    if (ok) setSong(null);
  }

  return createPortal(
    <>
      <div
        className={'profile-drawer-scrim' + (open ? ' is-open' : '')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={'profile-drawer my-song-panel' + (open ? ' is-open' : '')}
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-label="My Song"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      >
        <header className="profile-drawer__header">
          <div className="profile-drawer__identity">
            <div className="profile-drawer__who">
              <p className="profile-drawer__name">My Song</p>
            </div>
            <button className="profile-drawer__close" onClick={onClose} aria-label="Close My Song">
              ×
            </button>
          </div>
        </header>
        <div className="profile-drawer__panel">
          {loading ? (
            <p className="profile-drawer__note">Loading…</p>
          ) : song ? (
            <>
              <section className="profile-drawer__section">
                <h3 className="profile-drawer__section-title">{song.title}</h3>
                <SheetOverlay sheet={parseSheet(song.sheetSource)} />
              </section>
              <section className="profile-drawer__section">
                <h3 className="profile-drawer__section-title">Stored loops</h3>
                {song.loops.length === 0 && (
                  <p className="profile-drawer__note">No loops stored yet.</p>
                )}
                {song.loops.map(loop => (
                  <div className="profile-drawer__row" key={loop.name}>
                    <div className="profile-drawer__row-text">
                      <p className="profile-drawer__row-label">{loop.name}</p>
                    </div>
                    <button className="profile-drawer__row-btn" onClick={() => onLoadLoop(loop)}>
                      Load
                    </button>
                  </div>
                ))}
                <button className="profile-drawer__row-btn" onClick={() => void handleStoreLoops()}>
                  Store current loops
                </button>
              </section>
              <button className="profile-drawer__row-btn my-song-delete" onClick={() => void handleDelete()}>
                Delete song
              </button>
            </>
          ) : ent.lyricsImportUnlocked ? (
            <section className="profile-drawer__section my-song-import">
              <input
                className="my-song-input"
                placeholder="Song title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <textarea
                className="my-song-textarea"
                placeholder="Paste your lyrics and chords…"
                value={source}
                onChange={e => setSource(e.target.value)}
              />
              <button
                className="profile-drawer__row-btn"
                onClick={() => void handleImport()}
                disabled={!title.trim() || !source.trim()}
              >
                Import
              </button>
            </section>
          ) : (
            <p className="profile-drawer__note">Plus unlocks pasting in your song's lyrics and chords.</p>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
