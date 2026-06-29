import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

export default function LandingPage() {
  const navigate   = useNavigate();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);
  const touch = isTouchDevice();

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />
      <div className="landing-v2__ui">
        <FroolaLogo size={72} />
        <p className="landing-v2__tagline">play music with your hands</p>
        <p className="landing-v2__body">
          Froola turns your hand movements into music. Everything runs on your
          device — no video is ever transmitted or stored.
        </p>
        <div className="landing-v2__actions">
          <button
            className="landing-v2__btn-primary"
            onClick={() => navigate('/play', { state: { input: 'camera' } })}
          >
            Enable camera
          </button>
          <button
            className="landing-v2__btn-secondary"
            onClick={() => navigate('/play', { state: { input: 'mouse' } })}
          >
            {touch ? 'Use touch instead' : 'Use mouse instead'}
          </button>
        </div>
        <p className="landing-v2__privacy">Your camera never leaves your device.</p>
      </div>
    </div>
  );
}
