import { useState } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.origin + '/play');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="share-btn" onClick={handleShare}>
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
