import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';

export default function LandingPage() {
  const navigate   = useNavigate();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />
      <div className="landing-v2__ui">
        <FroolaLogo size={72} />
        <p className="landing-v2__tagline">play music with your hands</p>
        <div className="landing-v2__actions">
          <button className="landing-v2__btn-primary" onClick={() => navigate('/play')}>
            Play →
          </button>
        </div>
        <p className="landing-v2__privacy">Your camera never leaves your device.</p>
      </div>
    </div>
  );
}
