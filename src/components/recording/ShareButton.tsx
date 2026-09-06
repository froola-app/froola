import { useState } from 'react';
import { copyToClipboard } from './clipboard';
import { listRecordings } from '../../engine/recording/recordingStore';

export default function ShareButton() {
  const [label, setLabel] = useState<'Share' | 'Copied!' | 'Failed'>('Share');

  async function handleShare() {
    // Share the latest creation when there is one; the app itself otherwise.
    let url = window.location.origin + '/';
    try {
      const recs = await listRecordings();
      if (recs.length > 0) {
        const newest = recs.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
        url = window.location.origin + '/replay?r=' + newest.id;
      }
    } catch { /* store unavailable — plain app link */ }
    const ok = await copyToClipboard(url);
    setLabel(ok ? 'Copied!' : 'Failed');
    setTimeout(() => setLabel('Share'), 1500);
  }

  return (
    <button className="share-btn" onClick={handleShare}>
      {label}
    </button>
  );
}
