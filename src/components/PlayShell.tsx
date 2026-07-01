import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../engine/types';
import type { InputMode } from '../engine/input';
import { KEYS, SCALE_NAMES, buildCommand, type ScaleName, type MusicConfig } from '../engine/music';
import { ChordLooper, DEFAULT_BPM, type LooperState } from '../engine/looper';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';
import VideoRecordButton from './VideoRecordButton';
import GestureCoach from './GestureCoach';
import LoopPanel from './LoopPanel';
import FroolaLogo from './FroolaLogo';

const MODES: { value: InstrumentMode; label: string }[] = [
  { value: 'synth',  label: 'synth'  },
  { value: 'piano',  label: 'piano'  },
];

const OCTAVE_MIN = -2;
const OCTAVE_MAX = 2;

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
  const navigate = useNavigate();
  // Input mode comes from the landing page — either passed directly as a prop
  // (rendered inline) or via router state. Fall back to the prompt otherwise.
  const initialInput = inputProp ?? ((location.state as { input?: InputMode } | null)?.input) ?? 'asking';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('synth');
  const modeRef = useRef<InstrumentMode>(instrumentMode);
  modeRef.current = instrumentMode;

  const [octave, setOctave] = useState(0);
  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  // Key (tonic, 0–11 semitones above C) + scale select the 7 wheel notes.
  const [keyOffset, setKeyOffset] = useState(0);
  const [scale, setScale] = useState<ScaleName>('major');
  const musicRef = useRef<MusicConfig>({ keyOffset, scale });
  musicRef.current = { keyOffset, scale };

  // Chord looper: drives the chord pad while the hand solos over it. The ref
  // lets the coordinator's hot loop know when the loop owns the pad.
  const loopPlayingRef = useRef(false);
  const [loopState, setLoopState] = useState<LooperState>({
    slots: [], playing: false, bpm: DEFAULT_BPM, currentSlot: -1,
  });

  const changeOctave = useCallback((delta: number) => {
    setOctave(o => Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, o + delta)));
  }, []);

  const [volumeDisplay, setVolumeDisplay] = useState<number | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVolumeChange = useCallback((v: number) => {
    setVolumeDisplay(Math.round(v * 100));
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setVolumeDisplay(null), 1500);
  }, []);

  const [guardrailOn, setGuardrailOn] = useState(() => {
    try { return localStorage.getItem('froola.guardrail') !== 'false'; } catch { return true; }
  });
  const guardrailRef = useRef(guardrailOn);
  guardrailRef.current = guardrailOn;

  function toggleGuardrail() {
    const next = !guardrailOn;
    setGuardrailOn(next);
    try { localStorage.setItem('froola.guardrail', String(next)); } catch {}
  }

  // Arrow keys are a quick shortcut for the on-screen octave stepper.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp')        { e.preventDefault(); changeOctave(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); changeOctave(-1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeOctave]);

  const { mode, requestCamera, useMouse, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef, signalRef } = useCoordinator(canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, handleVolumeChange, loopPlayingRef, guardrailRef);
  // signalRef is used by BeginnerTutorial in Task 3 — kept in destructure to surface the interface.
  void signalRef;

  // Create the looper after mount (the engine exists by then), wiring its
  // scheduling/playback to the audio engine. The deps are all stable refs.
  const [looper, setLooper] = useState<ChordLooper | null>(null);
  useEffect(() => {
    const l = new ChordLooper({
      createClock: (cb, opts) => engineRef.current!.createClock(cb, opts),
      playAt: (c, when) => engineRef.current!.playAt(c, when, modeRef.current),
      silence: () => engineRef.current!.silence(modeRef.current),
      onChange: s => { setLoopState(s); loopPlayingRef.current = s.playing; },
    });
    setLooper(l);
    return () => l.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture the currently-selected chord as a new loop slot.
  const addCurrentChord = useCallback(() => {
    if (!looper) return;
    const { noteIdx, qualIdx } = selectedRef.current;
    looper.add(buildCommand(noteIdx, qualIdx, 0.5, octaveRef.current, musicRef.current));
  }, [looper, selectedRef]);

  // Enter is a quick shortcut for "+ chord" (ignored while a control is focused).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        t.tagName === 'BUTTON' || t.isContentEditable)) return;
      e.preventDefault();
      addCurrentChord();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addCurrentChord]);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {volumeDisplay !== null && (
        <div className="volume-badge">vol {volumeDisplay}%</div>
      )}
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      <ShareButton />
      <RecordButton selectedRef={selectedRef} vibe={vibe} />
      <VideoRecordButton canvasRef={canvasRef} cameraVideoRef={cameraVideoRef} engineRef={engineRef} />
      <button className="learn-nav-btn" onClick={() => navigate('/learn')}>Learn</button>
      {(mode === 'camera' || mode === 'mouse') && <GestureCoach mode={mode} />}
      {looper && (mode === 'camera' || mode === 'mouse') && (
        <LoopPanel looper={looper} state={loopState} onAddChord={addCurrentChord} />
      )}
      <div className="hud-bottom">
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
        <select
          className="instrument-select"
          value={keyOffset}
          onChange={e => setKeyOffset(Number(e.target.value))}
          aria-label="Key"
        >
          {KEYS.map((k, i) => (
            <option key={k} value={i}>{k}</option>
          ))}
        </select>
        <select
          className="instrument-select"
          value={scale}
          onChange={e => setScale(e.target.value as ScaleName)}
          aria-label="Scale"
        >
          {SCALE_NAMES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="octave-control" role="group" aria-label="Octave">
          <button
            className="octave-btn"
            onClick={() => changeOctave(-1)}
            disabled={octave <= OCTAVE_MIN}
            aria-label="Octave down"
          >
            −
          </button>
          <span className="octave-value">
            oct {octave > 0 ? `+${octave}` : octave}
          </span>
          <button
            className="octave-btn"
            onClick={() => changeOctave(1)}
            disabled={octave >= OCTAVE_MAX}
            aria-label="Octave up"
          >
            +
          </button>
        </div>
        <button
          className="guardrail-toggle"
          onClick={toggleGuardrail}
          aria-label={guardrailOn ? 'Hide hand guides' : 'Show hand guides'}
          title={guardrailOn ? 'Hide hand guides' : 'Show hand guides'}
        >
          {guardrailOn ? 'guide: on' : 'guide: off'}
        </button>
      </div>
    </>
  );
}
