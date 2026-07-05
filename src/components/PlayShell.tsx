import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../engine/types';
import { storeInputMode, type InputMode } from '../engine/input';
import { KEYS, SCALE_NAMES, buildCommand, type ScaleName, type MusicConfig } from '../engine/music';
import { ChordLooper, DEFAULT_BPM, type LooperState } from '../engine/looper';
import { Arpeggiator } from '../engine/arp';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';
import VideoRecordButton from './VideoRecordButton';
import ProfileButton from './ProfileButton';
import SignInPrompt from './SignInPrompt';
import LoopPanel from './LoopPanel';
import FroolaLogo from './FroolaLogo';
import BeginnerTutorial from './BeginnerTutorial';
import HandTiltPopup from './HandTiltPopup';

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
        <p className="permission-hint">
          You&apos;ll move both hands over two wheels — left picks the chord, right shapes it.
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

export default function PlayShell({ initialInput = 'asking' }: { initialInput?: InputMode } = {}) {
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('synth');
  const modeRef = useRef<InstrumentMode>(instrumentMode);
  useEffect(() => { modeRef.current = instrumentMode; }, [instrumentMode]);

  // The piano sampler downloads on first use — play() goes silent until it's
  // ready, which otherwise just looks broken. Poll while it's loading so the
  // select can say so instead.
  const [pianoLoading, setPianoLoading] = useState(false);

  const [octave, setOctave] = useState(0);
  const octaveRef = useRef(octave);
  useEffect(() => { octaveRef.current = octave; }, [octave]);

  // Key (tonic, 0–11 semitones above C) + scale select the 7 wheel notes.
  const [keyOffset, setKeyOffset] = useState(0);
  const [scale, setScale] = useState<ScaleName>('major');
  const musicRef = useRef<MusicConfig>({ keyOffset, scale });
  useEffect(() => { musicRef.current = { keyOffset, scale }; }, [keyOffset, scale]);

  // Chord looper: drives the chord pad while the hand solos over it. The ref
  // lets the coordinator's hot loop know when the loop owns the pad.
  const loopPlayingRef = useRef(false);
  const [loopState, setLoopState] = useState<LooperState>({
    slots: [], playing: false, bpm: DEFAULT_BPM, currentSlot: -1,
  });

  // Arpeggiator: turns a sustained chord into a repeating pattern. Defaults
  // on; the toggle button is an escape hatch back to a plain sustained pad.
  const arpRef = useRef<Arpeggiator | null>(null);
  const arpEnabledRef = useRef(true);
  const [arpEnabled, setArpEnabled] = useState(true);

  const changeOctave = useCallback((delta: number) => {
    setOctave(o => Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, o + delta)));
  }, []);

  const [volumeDisplay, setVolumeDisplay] = useState<number | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nod-to-volume is otherwise invisible — there's no control for it on the
  // wheel, just a head gesture. Show a small hint until the user's first nod
  // actually changes the volume, then never again.
  const [showNodHint, setShowNodHint] = useState(
    () => !localStorage.getItem('froola.nodHintSeen')
  );
  const handleVolumeChange = useCallback((v: number) => {
    setVolumeDisplay(Math.round(v * 100));
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setVolumeDisplay(null), 1500);
    try { localStorage.setItem('froola.nodHintSeen', '1'); } catch { /* private mode */ }
    setShowNodHint(false);
  }, []);


  // Arrow keys are a quick shortcut for the on-screen octave stepper.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp')        { e.preventDefault(); changeOctave(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); changeOctave(-1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeOctave]);

  const { mode, requestCamera, useMouse, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef, signalRef } = useCoordinator(canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, handleVolumeChange, loopPlayingRef, arpRef, arpEnabledRef);

  // Track the piano sampler download so the select can say it's loading
  // instead of silently doing nothing. preloadSampler de-dupes concurrent
  // calls, so it's safe to call again here even if the select's onChange
  // already kicked one off.
  useEffect(() => {
    if (instrumentMode !== 'piano' || engineRef.current?.isSamplerReady('piano')) return;
    let cancelled = false;
    setPianoLoading(true);
    preloadSampler('piano').then(() => { if (!cancelled) setPianoLoading(false); });
    return () => { cancelled = true; };
  }, [instrumentMode, engineRef, preloadSampler]);

  // Keep the persisted choice in sync with the live mode — covers a manual
  // in-session switch (mouse ↔ camera) and the automatic camera-denied
  // fallback, not just the initial choice made on the landing page.
  useEffect(() => {
    if (mode === 'camera' || mode === 'mouse') storeInputMode(mode);
  }, [mode]);

  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('froola.tutorialSeen')
  );
  // The tutorial hides itself with internal state once it finishes, so a
  // replay must remount it — bump the key to get a fresh run.
  const [tutorialRun, setTutorialRun] = useState(0);

  // Sidebar Settings → "Replay": clear the seen flags so the intro tips
  // and the nod hint run again, right now and on the next visit.
  const replayTutorial = useCallback(() => {
    try {
      localStorage.removeItem('froola.tutorialSeen');
      localStorage.removeItem('froola.nodHintSeen');
    } catch { /* private mode */ }
    setShowTutorial(true);
    setTutorialRun(r => r + 1);
    setShowNodHint(true);
  }, []);

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

  // Create the arpeggiator after mount, same pattern as the looper above.
  useEffect(() => {
    const a = new Arpeggiator({
      createClock: (cb, opts) => engineRef.current!.createClock(cb, opts),
      playNoteAt: (midi, when) => engineRef.current!.playNoteAt(midi, when),
      silence: () => engineRef.current!.silenceMelody(),
    });
    arpRef.current = a;
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleArp = useCallback(() => {
    setArpEnabled(v => {
      const next = !v;
      arpEnabledRef.current = next;
      if (!next) arpRef.current?.stop();
      return next;
    });
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
      {mode === 'camera' && <HandTiltPopup signalRef={signalRef} />}
      {showTutorial && mode !== 'asking' && (
        <BeginnerTutorial
          key={tutorialRun}
          signalRef={signalRef}
          selectedRef={selectedRef}
          mode={mode}
        />
      )}
      {volumeDisplay !== null && (
        <div className="volume-badge">vol {volumeDisplay}%</div>
      )}
      {mode === 'camera' && showNodHint && volumeDisplay === null && (
        <div className="nod-hint">nod up ↑ louder · nod down ↓ quieter</div>
      )}
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      {/* The permission screen (mode 'asking') is a full-viewport layer below
          the HUD's z-index, so hide the HUD until an input mode is chosen. */}
      {mode !== 'asking' && <>
      <ShareButton />
      <RecordButton selectedRef={selectedRef} vibe={vibe} />
      <VideoRecordButton canvasRef={canvasRef} cameraVideoRef={cameraVideoRef} engineRef={engineRef} />
      <button className="learn-nav-btn" onClick={() => navigate('/learn')}>Learn</button>
      <ProfileButton
        play={mode === 'camera' || mode === 'mouse' ? {
          inputMode: mode,
          onSwitchInput: mode === 'camera' ? useMouse : requestCamera,
          onReplayTutorial: replayTutorial,
        } : undefined}
      />
      <SignInPrompt />
      </>}
      {looper && (mode === 'camera' || mode === 'mouse') && (
        <LoopPanel looper={looper} state={loopState} onAddChord={addCurrentChord} />
      )}
      {mode !== 'asking' && <div className="hud-bottom">
        <select
          className="instrument-select"
          value={instrumentMode}
          onChange={e => setInstrumentMode(e.target.value as InstrumentMode)}
        >
          {MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {pianoLoading && <span className="instrument-loading">loading piano…</span>}
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
          className="octave-btn"
          onClick={toggleArp}
          aria-pressed={arpEnabled}
          aria-label="Toggle arpeggiator"
          title="When held, arpeggiate the sustained chord instead of a static pad"
        >
          arp {arpEnabled ? 'on' : 'off'}
        </button>
      </div>}
    </>
  );
}
