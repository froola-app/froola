import { useState } from 'react';
import { copyToClipboard } from './clipboard';

export default function ShareButton() {
  const [label, setLabel] = useState<'Share' | 'Copied!' | 'Failed'>('Share');

  async function handleShare() {
    const ok = await copyToClipboard(window.location.origin + '/');
    setLabel(ok ? 'Copied!' : 'Failed');
    setTimeout(() => setLabel('Share'), 1500);
  }

  return (
    <button className="share-btn" onClick={handleShare}>
      {label}
    </button>
  );
}
