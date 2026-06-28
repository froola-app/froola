import { useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useCoordinator } from './coordinator';
import './App.css';

// ---------- existing play-screen pieces (unchanged) ----------

function CameraPrompt({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  return (
    <div className="permission-screen">
      <h1>Froola</h1>
      <p className="privacy-note">Your camera never leaves your device.</p>
      <p>MediaPipe runs entirely on your device — no video is transmitted.</p>
      <div className="permission-buttons">
        <button onClick={onCamera} className="btn-primary">Enable camera</button>
        <button onClick={onMouse} className="btn-secondary">Use mouse instead</button>
      </div>
    </div>
  );
}

function MouseModeBadge({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="mode-badge">
      Mouse mode —{' '}
      <button onClick={onSwitch} className="link-btn">try camera mode</button>
    </div>
  );
}

function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode, requestCamera, useMouse } = useCoordinator(canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
    </>
  );
}

// ---------- landing page placeholder ----------

function LandingPage() {
  return <div className="landing-screen"><p>landing — coming in Task 3</p></div>;
}

// ---------- router ----------

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
    </Routes>
  );
}
