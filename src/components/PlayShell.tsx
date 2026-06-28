import { useRef, useState } from 'react';
import type { InstrumentMode } from '../engine/types';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';

const MODES: { value: InstrumentMode; label: string }[] = [
  { value: 'synth',  label: 'synth'  },
  { value: 'piano',  label: 'piano'  },
  { value: 'guitar', label: 'guitar' },
];

const isTouchDevice = () => navigator.maxTouchPoints > 0;

function CameraPrompt({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  const touch = isTouchDevice();
  return (
    <div className="permission-screen">
      <h1>Froola</h1>
      <p className="privacy-note">Your camera never leaves your device.</p>
      <p>MediaPipe runs entirely on your device — no video is transmitted.</p>
      <div className="permission-buttons">
        <button onClick={onCamera} className="btn-primary">Enable camera</button>
        <button onClick={onMouse} className="btn-secondary">
          {touch ? 'Use touch instead' : 'Use mouse instead'}
        </button>
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

export default function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('synth');
  const modeRef = useRef<InstrumentMode>(instrumentMode);
  modeRef.current = instrumentMode;

  const { mode, requestCamera, useMouse, signalRef, vibe, preloadSampler } = useCoordinator(canvasRef, modeRef);

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
