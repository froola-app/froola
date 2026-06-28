import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';

export default function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />
      <div className="landing-v2__ui">
        <FroolaLogo size={72} />
        <p className="landing-v2__tagline">play music with your hands</p>
        <div className="landing-v2__actions">
          <button className="landing-v2__btn-google" onClick={signInWithGoogle}>
            <img src="/google-logo.svg" alt="" width={18} height={18} />
            Continue with Google
          </button>
        </div>
        <p className="landing-v2__privacy">Your camera never leaves your device.</p>
      </div>
    </div>
  );
}
