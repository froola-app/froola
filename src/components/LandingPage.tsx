import { useRef, useState } from 'react';
import type { InputMode } from '../engine/input';
import FroolaLogo from './FroolaLogo';
import { useLandingCanvas } from '../hooks/useLandingCanvas';
import PlayShell from './PlayShell';
import { getRememberedInput, rememberInput, type RememberedInput } from '../lib/inputPreference';

const isTouchDevice = () => navigator.maxTouchPoints > 0;

export default function LandingPage() {
  // If the player chose camera or mouse in the last 10 minutes, skip the prompt
  // and start straight away with that choice.
  const [input, setInput] = useState<InputMode | null>(() => getRememberedInput());
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  useLandingCanvas(canvasRef);
  const touch = isTouchDevice();

  const choose = (mode: RememberedInput) => {
    rememberInput(mode);
    setInput(mode);
  };

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
            onClick={() => choose('camera')}
          >
            Enable camera
          </button>
          <button
            className="landing-v2__btn-secondary"
            onClick={() => choose('mouse')}
          >
            {touch ? 'Use touch instead' : 'Use mouse instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
