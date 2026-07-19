import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { entitlementsFor } from '../../entitlements';
import { listRecordings, deleteRecording, type RecordingMeta } from '../../engine/recording/recordingStore';
import { copyToClipboard } from '../../utils/clipboard';

const fmtDuration = (ms: number | null) => {
  if (ms == null) return '—';
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function RecordingsPanel({ open }: { open: boolean }) {
  const { user, profile } = useAuth();
  const ent = entitlementsFor(profile);
  const [rows, setRows] = useState<RecordingMeta[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    void listRecordings().then(rows => { if (!cancelled) setRows(rows); });
    return () => { cancelled = true; };
  }, [open, user]);

  useEffect(() => () => { if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current); }, []);

  if (!user) return <p className="profile-drawer__note">Sign in to keep your recordings and share links.</p>;

  const slots = Number.isFinite(ent.maxSavedRecordings)
    ? `${rows.length} of ${ent.maxSavedRecordings} used` : `${rows.length} saved`;

  return (
    <>
      <p className="profile-drawer__row-hint">{slots}</p>
      {rows.length === 0 && <p className="profile-drawer__note">Record a take on the play screen — it'll show up here with its share link.</p>}
      {rows.map(r => (
        <div className="profile-drawer__row" key={r.id}>
          <div className="profile-drawer__row-text">
            <p className="profile-drawer__row-label">{new Date(r.createdAt).toLocaleDateString()}</p>
            <p className="profile-drawer__row-hint">{fmtDuration(r.durationMs)}</p>
          </div>
          <button className="profile-drawer__row-btn" onClick={() => {
            void copyToClipboard(`${window.location.origin}/replay?r=${r.id}`);
            setCopiedId(r.id);
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
            copiedTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500);
          }}>{copiedId === r.id ? 'Copied!' : 'Copy link'}</button>
          <button className="profile-drawer__row-btn" aria-label="Delete recording" onClick={() => {
            void deleteRecording(r.id).then(ok => { if (ok) setRows(rs => rs.filter(x => x.id !== r.id)); });
          }}>Delete</button>
        </div>
      ))}
    </>
  );
}
