import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchSharedVideo } from '../engine/recording/videoRecordingStore';
import FroolaLogo from './FroolaLogo';

// Public playback for shared recordings (/watch?v=<id>). The video itself is
// the pitch — a person playing music with their hands — so the page stays
// minimal: the clip, the mark, one CTA.
export default function WatchShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('v');

  // undefined = fetching, null = unknown/deleted link. A missing ?v= is
  // derived below rather than set in the effect.
  const [fetched, setFetched] = useState<{ url: string; mime: string } | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchSharedVideo(id).then(v => { if (!cancelled) setFetched(v); });
    return () => { cancelled = true; };
  }, [id]);
  const video = id ? fetched : null;

  // The watch page is always the dark stage (see .watch-screen), so the mark
  // is always light regardless of the viewer's theme.
  const logoColor = '#F5F5F7';

  if (video === undefined) {
    return (
      <div className="watch-screen">
        <FroolaLogo size={48} color={logoColor} />
        <p className="watch-note">Loading…</p>
      </div>
    );
  }

  if (video === null) {
    return (
      <div className="watch-screen">
        <FroolaLogo size={48} color={logoColor} />
        <p className="watch-note">
          This recording is gone — its owner rerecorded or deleted it.
        </p>
        <button className="btn-primary" onClick={() => navigate('/play')}>
          Make your own →
        </button>
      </div>
    );
  }

  return (
    <div className="watch-screen">
      <a className="watch-brand" href="/" aria-label="froola home">
        <FroolaLogo size={32} color={logoColor} />
      </a>
      <video className="watch-video" src={video.url} controls autoPlay playsInline />
      <button className="btn-primary" onClick={() => navigate('/play')}>
        Make your own →
      </button>
    </div>
  );
}
