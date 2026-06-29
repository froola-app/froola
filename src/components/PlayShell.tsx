import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { InstrumentMode } from '../engine/types';
import type { InputMode } from '../engine/input';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';
import FroolaLogo from './FroolaLogo';

const MODES: { value: InstrumentMode; label: string }[] = [
  { value: 'synth',  label: 'synth'  },
  { value: 'piano',  label: 'piano'  },
];

const isTouchDevice = () => navigator.maxTouchPoints > 0;

function CameraPrompt({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  const touch = isTouchDevice();
  return (
    <div className="permission-screen">
      <div className="permission-card">
        <FroolaLogo size={56} color="#111111" />
        <p className="permission-eyebrow">Camera access</p>
        <h1 className="permission-title">Conduct with your hands</h1>
        <p className="permission-body">
          Froola turns your hand movements into music. MediaPipe runs entirely on
          your device — no video is ever transmitted or stored.
        </p>
        <p className="permission-privacy">Your camera never leaves your device.</p>
        <div className="permission-buttons">
          <button onClick={onCamera} className="permission-btn-primary">Enable camera</button>
          <button onClick={onMouse} className="permission-btn-secondary">
            {touch ? 'Use touch instead' : 'Use mouse instead'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MouseModeBadge({ onSwitch }: { onSwitch: () => void }) {
  const touch = isTouchDevice();
  return (
    <div className="mode-badge">
      {touch ? 'Touch mode' : 'Mouse mode'} —{' '}
      <button onClick={onSwitch} className="link-btn">try camera mode</button>
    </div>
  );
}

export default function PlayShell({ initialInput: inputProp }: { initialInput?: InputMode } = {}) {
  const location = useLocation();
  // Input mode comes from the landing page — either passed directly as a prop
  // (rendered inline) or via router state. Fall back to the prompt otherwise.
  const initialInput = inputProp ?? ((location.state as { input?: InputMode } | null)?.input) ?? 'asking';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('synth');
  const modeRef = useRef<InstrumentMode>(instrumentMode);
  modeRef.current = instrumentMode;

  const { mode, requestCamera, useMouse, signalRef, vibe, preloadSampler } = useCoordinator(canvasRef, modeRef, initialInput);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      <ShareButton />
      <RecordButton signalsRef={signalRef} vibe={vibe} />
      <select
        className="instrument-select"
        value={instrumentMode}
        onChange={e => {
          const m = e.target.value as InstrumentMode;
          setInstrumentMode(m);
          preloadSampler(m);
        }}
      >
        {MODES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </>
  );
}
