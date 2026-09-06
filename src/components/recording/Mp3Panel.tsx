import { useEffect, useState } from 'react';
import { listMp3s, getMp3Blob, deleteMp3, type Mp3Meta } from '../../engine/recording/mp3Store';

const fmtDuration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// MP3 exports live in this device's IndexedDB (see mp3Store.ts), so unlike
// RecordingsPanel there is no sign-in gate.
export default function Mp3Panel({ open }: { open: boolean }) {
  const [rows, setRows] = useState<Mp3Meta[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listMp3s().then(rows => { if (!cancelled) setRows(rows); });
    return () => { cancelled = true; };
  }, [open]);

  const download = async ({ id, createdAt }: Mp3Meta) => {
    const blob = await getMp3Blob(id);
    if (!blob) return;
    const d = new Date(createdAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `froola-${stamp}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {rows.length === 0 && (
        <p className="profile-drawer__note">
          Record an MP3 on the play screen — it'll show up here.
        </p>
      )}
      {rows.map(r => (
        <div className="profile-drawer__row" key={r.id}>
          <div className="profile-drawer__row-text">
            <p className="profile-drawer__row-label">{new Date(r.createdAt).toLocaleDateString()}</p>
            <p className="profile-drawer__row-hint">{fmtDuration(r.durationMs)}</p>
          </div>
          <button className="profile-drawer__row-btn" onClick={() => void download(r)}>
            Download
          </button>
          <button className="profile-drawer__row-btn" aria-label="Delete MP3" onClick={() => {
            void deleteMp3(r.id).then(ok => { if (ok) setRows(rs => rs.filter(x => x.id !== r.id)); });
          }}>Delete</button>
        </div>
      ))}
    </>
  );
}
