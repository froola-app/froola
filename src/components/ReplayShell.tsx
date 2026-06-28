import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ReplayShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const replayData = searchParams.get('d');

  if (!replayData) {
    return (
      <div className="landing-screen">
        <h1>Replay</h1>
        <p>This replay link is invalid.</p>
        <button className="btn-primary" onClick={() => navigate('/play')}>
          Play yourself →
        </button>
      </div>
    );
  }

  return (
    <div className="landing-screen">
      <h1>Replay</h1>
      <p>Coming soon — replay playback requires SP2 audio engine.</p>
      <button className="btn-primary" onClick={() => navigate('/play')}>
        Play yourself →
      </button>
    </div>
  );
}
