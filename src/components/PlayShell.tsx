import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../engine/types';
import { storeInputMode, type InputMode } from '../engine/input';
import { KEYS, SCALE_NAMES, buildCommand, wheelChord, type ScaleName, type ChordMode, type MusicConfig, type CustomWheel } from '../engine/music';
import { listWheels, saveWheel, deleteWheel } from '../engine/music/customWheelStore';
import WheelEditor from './WheelEditor';
import { ChordLooper, DEFAULT_BPM, DEFAULT_BEATS_PER_SLOT, listLoops, saveLoop, deleteLoop, type LooperState, type SavedLoop } from '../engine/looper';
import { Arpeggiator } from '../engine/arp';
import { useCoordinator } from '../coordinator';
import ShareButton from './recording/ShareButton';
import FeedbackButton from './FeedbackButton';
import RecordButton from './recording/RecordButton';
import VideoRecordButton from './recording/VideoRecordButton';
import AudioExportButton from './recording/AudioExportButton';
import ProfileButton from './account/ProfileButton';
import LoopPanel from './LoopPanel';
import FroolaLogo from './brand/FroolaLogo';
import BeginnerTutorial from './BeginnerTutorial';
import FroolaGuide from './brand/FroolaGuide';
import GlassDials from './GlassDials';
import MySongPanel from './MySongPanel';
import { useAmbientLuminance } from '../hooks/useAmbientLuminance';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTheme } from '../hooks/useTheme';
import { capabilities } from '../capabilities';

const MODES: { value: InstrumentMode; label: string }[] = [
  { value: 'synth',  label: 'synth'  },
  { value: 'piano',  label: 'piano'  },
];

const OCTAVE_MIN = -2;
const OCTAVE_MAX = 2;

// Camera access is requested automatically on mount (see the effect below),
// so this only ever appears after a denial — there's no explainer screen to
// click through first, just a way to retry once the user fixes permissions.
function CameraDenied({ onCamera }: { onCamera: () => void }) {
  const { theme } = useTheme();
  return (
    <div className="permission-screen">
      <div className="permission-card">
        <FroolaLogo size={56} color={theme === 'dark' ? '#F5F5F7' : '#111111'} />
        <p className="permission-error">
          Couldn&apos;t access your camera. Check your browser&apos;s permission settings and try again.
        </p>
        <div className="permission-buttons">
          <button onClick={onCamera} className="permission-btn-primary">Try again</button>
        </div>
      </div>
    </div>
  );
}

export default function PlayShell({ initialInput = 'asking' }: { initialInput?: InputMode } = {}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const ent = capabilities();
  const [mySongOpen, setMySongOpen] = useState(false);

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
  // Chord mode picks what the right wheel offers: in-key extensions
  // (triad/7th/sus…) or universal fixed qualities (maj/min/7/dim7…).
  const [keyOffset, setKeyOffset] = useState(0);
  const [scale, setScale] = useState<ScaleName>('major');
  const [chordMode, setChordMode] = useState<ChordMode>('diatonic');

  // Custom chord wheels (Plus+): user-defined root+quality per slice,
  // swapped in for the diatonic wheel in free play only (lessons use their
  // own shell and never read this musicRef — see the grep note in the PR).
  const [customWheels, setCustomWheels] = useState<CustomWheel[]>([]);
  const [activeWheelId, setActiveWheelId] = useState<string | null>(null);
  const [wheelEditor, setWheelEditor] = useState<'closed' | 'new' | 'edit'>('closed');
  const activeWheel = customWheels.find(w => w.id === activeWheelId) ?? null;

  const musicRef = useRef<MusicConfig>({ keyOffset, scale, chordMode, customWheel: activeWheel ?? undefined });
  useEffect(() => {
    musicRef.current = { keyOffset, scale, chordMode, customWheel: activeWheel ?? undefined };
  }, [keyOffset, scale, chordMode, activeWheel]);

  useEffect(() => {
    let cancelled = false;
    listWheels().then(ws => { if (!cancelled) setCustomWheels(ws); });
    return () => { cancelled = true; };
  }, []);

  // Chord looper: drives the chord pad while the hand solos over it. The ref
  // lets the coordinator's hot loop know when the loop owns the pad.
  const loopPlayingRef = useRef(false);
  const [loopState, setLoopState] = useState<LooperState>({
    slots: [], playing: false, bpm: DEFAULT_BPM, beatsPerSlot: DEFAULT_BEATS_PER_SLOT, currentSlot: -1,
  });

  // Arpeggiator: turns a sustained chord into a repeating pattern (Plus+).
  // Defaults on; the toggle button is an escape hatch back to a plain
  // sustained pad. Free plays a static pad only — no toggle, no arp.
  const arpRef = useRef<Arpeggiator | null>(null);
  const arpEnabledRef = useRef(true);
  const [arpEnabled, setArpEnabled] = useState(true);
  // Same downgrade rule as piano/themes: a lapsed plan must not leave the
  // arp running with no visible toggle to turn it off. Unlike the piano
  // guard above, this also stops the (external, impure) arpeggiator engine —
  // a real side effect, not just a state correction — so it stays an effect.
  const changeOctave = useCallback((delta: number) => {
    setOctave(o => Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, o + delta)));
  }, []);

  // Arrow keys are a quick shortcut for the on-screen octave stepper
  // (ignored while a control is focused, e.g. arrow keys moving the cursor
  // in the My Song textarea).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        t.tagName === 'BUTTON' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.key === 'ArrowUp') changeOctave(1);
      else changeOctave(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeOctave]);

  const { mode, requestCamera, cameraError, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef, signalRef, sustainedRef } = useCoordinator(canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, loopPlayingRef, arpRef, arpEnabledRef, undefined);

  // Live chord label for the video export chip: reads the current wheel
  // selection per frame via a stable getter (both refs are stable), so the
  // export chip always names the chord actually sounding.
  const getChordLabel = useCallback(
    () => wheelChord(selectedRef.current.noteIdx, selectedRef.current.qualIdx, musicRef.current).label,
    [selectedRef],
  );

  // No explainer screen to click through — ask for the camera the moment
  // the page loads. Only fires once: after a denial, mode reverts to
  // 'asking' too, and re-requesting there would loop the browser prompt.
  const autoRequestedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'asking' || cameraError || autoRequestedRef.current) return;
    autoRequestedRef.current = true;
    requestCamera();
  }, [mode, cameraError, requestCamera]);

  // Watch the camera feed's brightness and flag the HUD zones on <html> so
  // the glass controls flip to dark ink over bright scenes (see App.css).
  useAmbientLuminance(cameraVideoRef, mode);

  // Browsers keep the audio context suspended until a user gesture they
  // accept. The coordinator retries resume() on every interaction, but if the
  // context is still stuck shortly after mount (e.g. a hard reload straight
  // into camera mode, where hands never touch the page), the player just
  // hears nothing — say so instead.
  const [audioStuck, setAudioStuck] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      const st = engineRef.current?.audioState();
      setAudioStuck(st === 'suspended' && !document.hidden);
    }, 1000);
    return () => clearInterval(t);
  }, [engineRef]);

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

  // Keep the persisted choice in sync with the live mode — not just the
  // initial choice made on the landing page.
  useEffect(() => {
    if (mode === 'camera') storeInputMode(mode);
  }, [mode]);

  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('froola.tutorialSeen')
  );
  // Flips when the tutorial leaves the screen — gates the froo guide so it
  // never talks over the tutorial.
  const [tutorialDone, setTutorialDone] = useState(
    () => !!localStorage.getItem('froola.tutorialSeen')
  );
  // The tutorial hides itself with internal state once it finishes, so a
  // replay must remount it — bump the key to get a fresh run.
  const [tutorialRun, setTutorialRun] = useState(0);

  // Sidebar Settings → "Replay": clear the seen flags so the intro tips
  // run again, right now and on the next visit.
  const replayTutorial = useCallback(() => {
    try {
      localStorage.removeItem('froola.tutorialSeen');
      // Restart froo's tour too — replaying the tutorial signals the user
      // wants the guidance back, and the guide remounts via tutorialRun.
      localStorage.removeItem('froola.guideStep');
      localStorage.removeItem('froola.guideDone');
    } catch { /* private mode */ }
    setShowTutorial(true);
    setTutorialDone(false);
    setTutorialRun(r => r + 1);
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
      // Duck the sustained pad under the arp — the pattern is inaudible if the
      // full-volume drone (the same pitches) keeps playing on top of it.
      playNoteAt: (midi, when, duration) => {
        const e = engineRef.current!;
        e.setPadDuck(true);
        e.playNoteAt(midi, when, duration);
      },
      silence: () => {
        const e = engineRef.current!;
        e.setPadDuck(false);
        e.silenceMelody();
      },
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
    if (!looper || loopState.slots.length >= ent.loopSlots) return;
    const { noteIdx, qualIdx } = selectedRef.current;
    looper.add(buildCommand(noteIdx, qualIdx, 0.5, octaveRef.current, musicRef.current));
  }, [looper, selectedRef, loopState.slots.length, ent.loopSlots]);

  // Record-arm: while armed, poll the sustained-fist ref and capture the
  // current chord on each rising edge (fresh fist lock), so a player can lock
  // in a whole progression hands-free instead of reaching for "+ chord" each
  // time. Auto-disarms once the loop fills to the plan's slot cap.
  const [loopArmed, setLoopArmed] = useState(false);
  const prevSustainedRef = useRef(false);
  const toggleLoopArm = useCallback(() => {
    setLoopArmed(v => {
      // Seed with the live sustained value (not a hardcoded false) so a fist
      // already held at the moment of arming isn't mistaken for a fresh
      // rising edge on the first poll tick — only a *new* squeeze after
      // arming should capture.
      prevSustainedRef.current = sustainedRef.current;
      return !v;
    });
  }, [sustainedRef]);

  // addCurrentChord's identity changes on every capture (it closes over
  // loopState.slots.length), so this effect tears down and restarts the
  // interval each time a chord lands. That's harmless by design: the
  // rising-edge state lives in prevSustainedRef, not in this effect's
  // closure, so a restart never causes a double-capture or a missed edge.
  useEffect(() => {
    if (!loopArmed || !looper) return;
    const id = setInterval(() => {
      const sustained = sustainedRef.current;
      if (sustained && !prevSustainedRef.current) addCurrentChord();
      prevSustainedRef.current = sustained;
    }, 100);
    return () => clearInterval(id);
  }, [loopArmed, looper, addCurrentChord, sustainedRef]);

  useEffect(() => {
    if (loopArmed && loopState.slots.length >= ent.loopSlots) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disarming is a derived correction to external loop-fill state, same pattern as the arp downgrade guard above
      setLoopArmed(false);
    }
  }, [loopArmed, loopState.slots.length, ent.loopSlots]);

  // Saved-loop library: read once on mount, refreshed after save/delete.
  const [savedLoops, setSavedLoops] = useState<SavedLoop[]>(() => listLoops());
  const handleSaveLoop = useCallback((name: string) => {
    if (!looper) return;
    saveLoop({ name, bpm: loopState.bpm, beatsPerSlot: loopState.beatsPerSlot, slots: looper.getSlots(), savedAt: Date.now() });
    setSavedLoops(listLoops());
  }, [looper, loopState.bpm, loopState.beatsPerSlot]);
  const handleLoadLoop = useCallback((loop: SavedLoop) => {
    looper?.load(loop);
  }, [looper]);
  const handleDeleteLoop = useCallback((name: string) => {
    deleteLoop(name);
    setSavedLoops(listLoops());
  }, []);

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
      {mode === 'camera' && <GlassDials />}
      {/* Mobile is a bare canvas: no tutorial, no guide, no HUD — just the
          camera and the wheels. Every control below is desktop-only. */}
      {!isMobile && showTutorial && mode === 'camera' && (
        <BeginnerTutorial
          key={`tutorial-${tutorialRun}`}
          signalRef={signalRef}
          onDone={() => setTutorialDone(true)}
        />
      )}
      {!isMobile && (
        <FroolaGuide
          key={`guide-${tutorialRun}`}
          loopState={loopState}
          active={tutorialDone && mode === 'camera'}
          loopUnlocked={ent.loopUnlocked}
        />
      )}
      {audioStuck && (
        <div className="nod-hint">tap anywhere for sound</div>
      )}
      {mode === 'asking' && cameraError && (
        <CameraDenied onCamera={requestCamera} />
      )}
      {/* The permission screen (mode 'asking') is a full-viewport layer below
          the HUD's z-index, so hide the HUD until camera access is granted. */}
      {mode !== 'asking' && <>
      {!isMobile && <div className="hud-capture">
        <RecordButton
          selectedRef={selectedRef}
          vibe={vibe}
          maxDurationMs={ent.maxReplayRecordMs}
          watermark={ent.replayWatermark}
          maxSavedRecordings={ent.maxSavedRecordings}
        />
        <VideoRecordButton
          canvasRef={canvasRef}
          cameraVideoRef={cameraVideoRef}
          engineRef={engineRef}
          maxDurationMs={ent.maxVideoRecordMs}
          watermark={ent.exportWatermark}
          getChordLabel={getChordLabel}
        />
        <AudioExportButton
          engineRef={engineRef}
          maxDurationMs={ent.maxVideoRecordMs}
        />
      </div>}
      {/* Mobile keeps exactly one control: the profile avatar. It's the only
          way off the play screen on a phone (sign-in, settings, upgrade), so
          it stays while Learn/Share/Feedback go. "Replay tutorial" is desktop
          -only because the tutorial itself doesn't render on mobile. */}
      <div className="hud-nav">
        {!isMobile && <>
        <button className="learn-nav-btn" onClick={() => navigate('/learn')}>Learn</button>
        <ShareButton />
        <FeedbackButton />
        </>}
        <ProfileButton
          play={!isMobile && mode === 'camera' ? { onReplayTutorial: replayTutorial } : undefined}
        />
      </div>
      </>}
      {/* Mobile gets no controls at all — instrument, key, scale, chord mode,
          wheel, octave and arp stay at their defaults (synth, C major,
          in-key, octave 0, arp on) and are only reachable on a wider screen. */}
      {mode !== 'asking' && !isMobile && <div className="hud-bottom-stack">
        {looper && mode === 'camera' && ent.loopUnlocked && (
          <LoopPanel
            looper={looper}
            state={loopState}
            onAddChord={addCurrentChord}
            maxSlots={ent.loopSlots}
            armed={loopArmed}
            onToggleArm={toggleLoopArm}
            savedLoops={savedLoops}
            onSaveLoop={handleSaveLoop}
            onLoadLoop={handleLoadLoop}
            onDeleteLoop={handleDeleteLoop}
          />
        )}
        <div className="hud-bottom">
        <select
          className="instrument-select"
          value={instrumentMode}
          onChange={e => {
            const next = e.target.value as InstrumentMode;
            setInstrumentMode(next);
          }}
        >
          {MODES.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
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
        <select
          className="instrument-select"
          value={chordMode}
          onChange={e => setChordMode(e.target.value as ChordMode)}
          aria-label="Chord mode"
          title="in-key: extensions on the scale's own chords · universal: maj/min/7/dim7… on any root"
        >
          <option value="diatonic">in-key</option>
          <option value="universal">universal</option>
        </select>
        <select
          className="instrument-select"
          value={activeWheelId ?? ''}
          aria-label="Wheel"
          onChange={e => {
            const v = e.target.value;
            if (v === '__new') { setWheelEditor('new'); return; }
            setActiveWheelId(v || null);
          }}
        >
          <option value="">in-key wheel</option>
          {customWheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          <option value="__new">+ new wheel…</option>
        </select>
        {activeWheel && ent.customWheelsUnlocked && (
          <button className="octave-btn" onClick={() => setWheelEditor('edit')} aria-label="Edit wheel">✎</button>
        )}
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
          className="octave-btn arp-btn"
          onClick={toggleArp}
          aria-pressed={arpEnabled}
          aria-label="Toggle arpeggiator"
          title="When held, arpeggiate the sustained chord instead of a static pad"
        >
          arp {arpEnabled ? 'on' : 'off'}
        </button>
        <button
          className="octave-btn my-song-btn"
          onClick={() => setMySongOpen(true)}
          aria-label="My Song"
          title="Your saved lyrics+chords sheet and stored loops"
        >
          My Song
        </button>
        </div>
      </div>}
      {mySongOpen && (
        <MySongPanel
          open={mySongOpen}
          onClose={() => setMySongOpen(false)}
          onLoadLoop={loop => looper?.load(loop)}
        />
      )}
      {wheelEditor !== 'closed' && (
        <WheelEditor
          keyOffset={keyOffset}
          scale={scale}
          initial={wheelEditor === 'edit' ? activeWheel : null}
          onClose={() => setWheelEditor('closed')}
          onSave={async (name, slices, id) => {
            const saved = await saveWheel(name, slices, id);
            if (saved) {
              setCustomWheels(ws => id ? ws.map(w => (w.id === id ? saved : w)) : [...ws, saved]);
              setActiveWheelId(saved.id);
            }
            setWheelEditor('closed');
          }}
          onDelete={async id => {
            await deleteWheel(id);
            setCustomWheels(ws => ws.filter(w => w.id !== id));
            setActiveWheelId(null);
            setWheelEditor('closed');
          }}
        />
      )}
    </>
  );
}
