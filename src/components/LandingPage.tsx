import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-screen">
      <h1 className="landing-title">froola</h1>
      <p className="landing-tagline">play music with your hands</p>
      <button className="btn-primary" onClick={() => navigate('/play')}>
        Play →
      </button>
    </div>
  );
}
