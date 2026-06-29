import { useRef, useState } from 'react';
import type { InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';
import PlayShell from './PlayShell';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

export default function LandingPage() {
  const [input, setInput] = useState<InputMode | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);
  const touch = isTouchDevice();

  // Start playing inline — no URL change, same screen.
  if (input) return <PlayShell initialInput={input} />;

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />
      <div className="landing-v2__ui">
        <FroolaLogo size={72} />
        <p className="landing-v2__tagline">play music with your hands</p>
        <div className="landing-v2__actions">
          <button
            className="landing-v2__btn-primary"
            onClick={() => setInput('camera')}
          >
            Enable camera
          </button>
          <button
            className="landing-v2__btn-secondary"
            onClick={() => setInput('mouse')}
          >
            {touch ? 'Use touch instead' : 'Use mouse instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
