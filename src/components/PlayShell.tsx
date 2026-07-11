import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../engine/types';
import { storeInputMode, type InputMode } from '../engine/input';
import { KEYS, SCALE_NAMES, buildCommand, type ScaleName, type ChordMode, type MusicConfig } from '../engine/music';
import { ChordLooper, DEFAULT_BPM, DEFAULT_BEATS_PER_SLOT, type LooperState } from '../engine/looper';
import { Arpeggiator } from '../engine/arp';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';
import VideoRecordButton from './VideoRecordButton';
import ProfileButton from './ProfileButton';
import LoopPanel from './LoopPanel';
import FroolaLogo from './FroolaLogo';
import BeginnerTutorial from './BeginnerTutorial';
import FroolaGuide from './FroolaGuide';
import PlayWall from './PlayWall';
import GlassDials from './GlassDials';
import UpgradeSheet, { type LockedFeature } from './UpgradeSheet';
import { useAmbientLuminance } from '../hooks/useAmbientLuminance';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePlayWall } from '../hooks/usePlayWall';
import { useTheme } from '../useTheme';
import { useAuth } from '../contexts/AuthContext';
import { entitlementsFor } from '../entitlements';

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

  const { profile } = useAuth();
  const ent = entitlementsFor(profile);

  // Which locked feature the user just reached for, if any — opens the
  // in-context upgrade sheet instead of bouncing them to /pricing.
  const [upsell, setUpsell] = useState<LockedFeature | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('synth');
  // A downgrade mid-session (subscription lapses, sign-out) must not leave a
  // locked instrument playing. Adjusted during render rather than in an
  // effect — a pure state correction, so it can land before the invalid
  // selection gets a frame to play through (see react.dev "Adjusting some
  // state when a prop changes").
  const [prevPianoUnlocked, setPrevPianoUnlocked] = useState(ent.pianoUnlocked);
  if (prevPianoUnlocked !== ent.pianoUnlocked) {
    setPrevPianoUnlocked(ent.pianoUnlocked);
    if (!ent.pianoUnlocked && instrumentMode === 'piano') setInstrumentMode('synth');
  }
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
  const musicRef = useRef<MusicConfig>({ keyOffset, scale, chordMode });
  useEffect(() => { musicRef.current = { keyOffset, scale, chordMode }; }, [keyOffset, scale, chordMode]);

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
  useEffect(() => {
    if (!ent.arpUnlocked && arpEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- also stops the arpeggiator engine below, a real external side effect
      setArpEnabled(false);
      arpEnabledRef.current = false;
      arpRef.current?.stop();
    }
  }, [ent.arpUnlocked, arpEnabled]);

  const changeOctave = useCallback((delta: number) => {
    setOctave(o => Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, o + delta)));
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

  const gatedRef = useRef(false);
  const { mode, requestCamera, cameraError, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef, signalRef } = useCoordinator(canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, loopPlayingRef, arpRef, arpEnabledRef, undefined, gatedRef);

  // No explainer screen to click through — ask for the camera the moment
  // the page loads. Only fires once: after a denial, mode reverts to
  // 'asking' too, and re-requesting there would loop the browser prompt.
  const autoRequestedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'asking' || cameraError || autoRequestedRef.current) return;
    autoRequestedRef.current = true;
    requestCamera();
  }, [mode, cameraError, requestCamera]);

  const gated = usePlayWall(mode !== 'asking');
  useEffect(() => { gatedRef.current = gated; }, [gated]);

  useEffect(() => {
    if (gated) engineRef.current?.suspend();
    else engineRef.current?.resume();
  }, [gated, engineRef]);

  // React can't recover if an external actor (browser devtools) deletes a
  // node it rendered — reconciliation throws when it tries to remove the
  // already-gone node. So don't remount: put the exact node back where it
  // was and React never notices. Audio/input stay gated regardless (see
  // coordinator.ts's gatedRef), but the wall should never be removable.
  useEffect(() => {
    if (!gated) return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.removedNodes) {
          if (node instanceof HTMLElement &&
              (node.classList.contains('play-wall') || node.querySelector('.play-wall'))) {
            if (m.nextSibling && m.nextSibling.parentNode === m.target) {
              m.target.insertBefore(node, m.nextSibling);
            } else {
              m.target.appendChild(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [gated]);

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
      {/* Unlike Froo's post-tutorial tour and the loop panel (still
          mobile-hidden below), this teaches hand positioning — "no
          tutorial, no warning of the hand not being well positioned" was
          the actual complaint, so mobile keeps it. */}
      {showTutorial && mode === 'camera' && (
        <BeginnerTutorial
          key={`tutorial-${tutorialRun}`}
          signalRef={signalRef}
          selectedRef={selectedRef}
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
      <ShareButton />
      <RecordButton selectedRef={selectedRef} vibe={vibe} maxDurationMs={ent.maxReplayRecordMs} watermark={ent.replayWatermark} />
      <VideoRecordButton
        canvasRef={canvasRef}
        cameraVideoRef={cameraVideoRef}
        engineRef={engineRef}
        maxDurationMs={ent.maxVideoRecordMs}
        watermark={ent.replayWatermark}
        locked={!ent.videoRecordUnlocked}
        onLockedClick={() => setUpsell('video')}
      />
      <button className="learn-nav-btn" onClick={() => navigate('/learn')}>Learn</button>
      <ProfileButton
        play={mode === 'camera' ? { onReplayTutorial: replayTutorial } : undefined}
      />
      </>}
      {!isMobile && looper && mode === 'camera' && ent.loopUnlocked && (
        <LoopPanel looper={looper} state={loopState} onAddChord={addCurrentChord} maxSlots={ent.loopSlots} />
      )}
      {/* Mobile keeps only the two controls that shape which notes are on
          the wheels — instrument/octave/arp stay at their defaults
          (synth, octave 0, arp on) and are only reachable on a wider
          screen, so the phone HUD doesn't crowd the canvas. */}
      {mode !== 'asking' && <div className="hud-bottom">
        {!isMobile && <>
        <select
          className="instrument-select"
          value={instrumentMode}
          onChange={e => {
            const next = e.target.value as InstrumentMode;
            if (next === 'piano' && !ent.pianoUnlocked) { setUpsell('piano'); return; }
            setInstrumentMode(next);
          }}
        >
          {MODES.map(m => (
            <option key={m.value} value={m.value}>
              {m.value === 'piano' && !ent.pianoUnlocked ? '🔒 piano · plus' : m.label}
            </option>
          ))}
        </select>
        {pianoLoading && <span className="instrument-loading">loading piano…</span>}
        </>}
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
        {!isMobile && <div className="octave-control" role="group" aria-label="Octave">
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
        </div>}
        {!isMobile && ent.arpUnlocked && <button
          className="octave-btn arp-btn"
          onClick={toggleArp}
          aria-pressed={arpEnabled}
          aria-label="Toggle arpeggiator"
          title="When held, arpeggiate the sustained chord instead of a static pad"
        >
          arp {arpEnabled ? 'on' : 'off'}
        </button>}
      </div>}
      {upsell && <UpgradeSheet feature={upsell} onClose={() => setUpsell(null)} />}
      {gated && <PlayWall />}
    </>
  );
}
