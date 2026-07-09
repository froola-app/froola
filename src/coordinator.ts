// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, InstrumentMode, MusicalCommand } from './engine/types';
import { useGestureInput, type InputMode } from './engine/input';
import { useRenderer, type DialSelection } from './engine/renderer';
import { wheelGeometry } from './engine/renderer/geometry';
import { buildCommand, melodyMidi, DEFAULT_MUSIC, type MusicConfig } from './engine/music';
import { AudioEngine } from './engine/audio';
import type { Arpeggiator } from './engine/arp';

const REGISTER_THRESHOLD = 0.5 / 24;
// How long a chord keeps ringing after both hands briefly leave the wheels, so
// crossing the centre hub or a dropped tracking frame doesn't cut the note.
const SILENCE_GRACE_MS = 140;
// A fist must hold steady this long before it toggles sustain, so a flickering
// hand-shape detection can't stutter the hold on and off.
const FIST_DEBOUNCE_MS = 120;
// Hand height (0 = top, 1 = bottom) maps to arp rate — higher hand plays faster.
const ARP_MIN_BPM = 60;
const ARP_MAX_BPM = 240;
const mapYToArpBpm = (y: number) => ARP_MAX_BPM - y * (ARP_MAX_BPM - ARP_MIN_BPM);

export function useCoordinator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modeRef: RefObject<InstrumentMode>,
  initialMode: InputMode = 'asking',
  octaveRef?: RefObject<number>,
  // When provided, drive playback from this signal source (e.g. recorded replay)
  // instead of live hand input. The gesture-input hook still runs but its
  // signals are ignored, so live and replay share one audio/render pipeline.
  externalSignalRef?: RefObject<GestureSignal[]>,
  // Current key + scale; selects the 7 wheel notes. Defaults to C major.
  musicRef?: RefObject<MusicConfig>,
  // Optional ghost orb signals for lesson mode — translucent target-hand indicators.
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  // When true, the chord looper drives the chord pad; the hand solos a melody
  // lead instead of triggering chords.
  loopPlayingRef?: RefObject<boolean>,
  // Turns a sustained chord into a repeating arpeggio instead of a static
  // drone. Rate follows hand height; disabled via arpEnabledRef falls back
  // to a plain sustained pad (today's pre-feature behaviour).
  arpRef?: RefObject<Arpeggiator | null>,
  arpEnabledRef?: RefObject<boolean>,
  guardrailRef?: RefObject<boolean>,
  // When true, no code path here may produce sound or act on gesture input —
  // the PlayWall sign-up gate is up. Checked instead of relying solely on the
  // overlay's DOM node blocking pointer events, since that node can be
  // deleted via devtools.
  gatedRef?: RefObject<boolean>,
) {
  const engineRef = useRef<AudioEngine | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const selectedRef = useRef<DialSelection>({ noteIdx: 0, qualIdx: 0 });
  // Written every hot-loop frame; read by UI that wants to show a fist-lock /
  // sustain indicator without re-rendering on every frame itself.
  const sustainedRef = useRef(false);

  const input = useGestureInput(initialMode);
  const signalRef = externalSignalRef ?? input.signalRef;
  const { mode, requestCamera, cameraError, cameraVideoRef } = input;

  // Create AudioEngine once. Browsers create the context suspended until the
  // page has user activation. The landing-page CTA click happens before this
  // mounts (client-side navigation), which grants sticky activation — so try
  // resuming immediately, then keep retrying on any interaction until the
  // context is running. Camera users may never press anything on /play, so
  // waiting for a single pointerdown here would leave them in silence.
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    analyserRef.current = engine.getAnalyser();

    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
    const resume = () => {
      if (gatedRef?.current) return;
      engine.resume();
      if (engine.audioState() === 'running') {
        for (const ev of events) window.removeEventListener(ev, resume);
      }
    };
    engine.resume();
    for (const ev of events) window.addEventListener(ev, resume);

    return () => {
      engine.suspend();
      for (const ev of events) window.removeEventListener(ev, resume);
    };
  }, []);

  // Pause all audio while the tab is backgrounded: Web Audio keeps scheduling
  // sound (sustained chords, arps, backing loops) even when rAF is throttled,
  // so a hidden tab would keep playing. Suspending the context freezes the
  // whole graph; resuming continues a held chord exactly where it was.
  useEffect(() => {
    const onVisibility = () => {
      const engine = engineRef.current;
      if (!engine) return;
      if (document.hidden) engine.suspend();
      else if (!gatedRef?.current) engine.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Hot path: rAF loop — reads dial selection + y-register, drives audio
  useEffect(() => {
    let rafId: number;
    let lastNoteIdx = -1;
    let lastQualIdx = -1;
    let lastY = -1;
    let lastOctave = 0;
    let lastMusicKey = '';
    let sounding = false;
    // The most recently built chord command, kept around after the hand
    // leaves the wheel so a sustained chord still knows what it's holding.
    let lastCmd: MusicalCommand | null = null;
    let lastTouchMs = -Infinity;
    // Sustain (hold) state. `spaceHeld` is the keyboard pedal; `sustainToggle`
    // is flipped by a debounced fist (the camera equivalent). While sustained,
    // a ringing chord is simply not released — sustain never re-attacks, so
    // engaging it produces no extra sound.
    let spaceHeld = false;
    let sustainToggle = false;
    let rawFistLast = false;
    let fistChangedMs = -Infinity;
    let fistStable = false;
    // Melody lead note currently sounding while the loop plays (-1 = none).
    let melodyNote = -1;

    // Space = sustain pedal. It must not hijack Space inside a text field or a
    // select (those use it natively), but over a focused *button* it blurs the
    // button and takes Space for the pedal — otherwise clicking a HUD control
    // (play, +chord, octave…) would swallow the pedal until you clicked away.
    // Buttons stay Enter-activatable.
    const editableTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || editableTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') e.target.blur();
      e.preventDefault();
      spaceHeld = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || editableTarget(e.target)) return;
      spaceHeld = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function tick() {
      const signals = signalRef.current;
      const left  = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      // Replicate wheel geometry from renderer so we can do the hit-test here
      // without depending on the renderer's rAF writing to a shared ref first.
      const canvas = canvasRef.current;
      const w = canvas?.width  ?? window.innerWidth;
      const h = canvas?.height ?? window.innerHeight;
      const { outerR, innerR, leftCx, rightCx, leftCy, rightCy } = wheelGeometry(w, h);
      const inRing = (x: number, y: number, cx: number, cy: number) => {
        const d = Math.hypot(x * w - cx, y * h - cy);
        return d >= innerR && d <= outerR;
      };
      const leftInDial  = !!left?.present  && inRing(left.x,  left.y,  leftCx,  leftCy);
      const rightInDial = !!right?.present && inRing(right.x, right.y, rightCx, rightCy);

      const { noteIdx, qualIdx } = selectedRef.current;
      const instrMode = modeRef.current;
      const engine = engineRef.current;
      const octave = octaveRef?.current ?? 0;
      const music = musicRef?.current ?? DEFAULT_MUSIC;
      const nowMs = performance.now();

      // Sign-up wall is up — no code path here may produce sound or act on
      // gesture input, independent of whether the PlayWall overlay's DOM
      // node still exists (it can be deleted via devtools).
      if (gatedRef?.current) {
        if (sounding && engine) { engine.silence(instrMode); sounding = false; }
        if (arpRef?.current?.running) arpRef.current.stop();
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Kick off sampler loading as soon as user selects piano
      if (instrMode === 'piano' && engine) {
        engine.startLoadingSampler(instrMode);
      }

      // While the loop is playing it owns the chord pad (via engine.playAt), so
      // the coordinator must not touch it — the hand solos a melody lead instead.
      if (loopPlayingRef?.current) {
        if (sounding) { sounding = false; lastNoteIdx = -1; lastQualIdx = -1; }
        if (leftInDial && engine) {
          if (noteIdx !== melodyNote) {
            engine.playMelody(melodyMidi(noteIdx, music));
            melodyNote = noteIdx;
          }
        } else if (melodyNote !== -1 && engine) {
          engine.silenceMelody();
          melodyNote = -1;
        }
        rafId = requestAnimationFrame(tick);
        return;
      }
      // Just exited loop mode — make sure the lead isn't left ringing.
      if (melodyNote !== -1 && engine) { engine.silenceMelody(); melodyNote = -1; }

      // Sustain (hold): keep the current chord ringing without re-triggering it.
      // A fist toggles the hold — debounced so a flickering hand-shape detection
      // can't stutter it — and the Space pedal is tracked by the key listeners
      // above. Engaging sustain never calls engine.play(), so there's no extra
      // attack; releasing it lets the normal path silence the chord.
      const rawFist = !!(left?.fist || right?.fist);
      if (rawFist !== rawFistLast) { rawFistLast = rawFist; fistChangedMs = nowMs; }
      if (rawFist !== fistStable && nowMs - fistChangedMs >= FIST_DEBOUNCE_MS) {
        fistStable = rawFist;
        if (fistStable) sustainToggle = !sustainToggle; // fist fully closed → toggle hold
      }
      const sustained = spaceHeld || sustainToggle;
      sustainedRef.current = sustained;

      // Left hand on its wheel = chord plays. Right hand on its wheel modifies
      // the chord quality. If the right hand is absent, fall back to a plain
      // triad (qualIdx 0).
      const touching = leftInDial;
      const effectiveQualIdx = rightInDial ? qualIdx : 0;
      if (touching) lastTouchMs = nowMs;
      // A brief loss of contact (crossing the centre hub between slices, a dropped
      // tracking frame) holds the note instead of cutting it — avoids glitchy
      // silence/retrigger as you move around the wheels.
      const inGrace = !touching && (nowMs - lastTouchMs) < SILENCE_GRACE_MS;

      if (touching && engine) {
        const y = left?.present ? left.y : (right?.y ?? lastY);
        const yChanged = instrMode === 'synth' && Math.abs(y - lastY) > REGISTER_THRESHOLD;
        const selChanged = noteIdx !== lastNoteIdx || effectiveQualIdx !== lastQualIdx;
        const octChanged = octave !== lastOctave;
        // Re-voice a held chord when the key/scale changes too (otherwise
        // changing the dropdown mid-hold does nothing until the next note).
        const musicKey = `${music.keyOffset}:${music.scale}`;
        const musicChanged = musicKey !== lastMusicKey;
        // Built every touching frame (cheap, pure) so a sustained arp always
        // knows the wheel's current chord, even on frames that don't re-attack.
        const cmd = buildCommand(noteIdx, effectiveQualIdx, y, octave, music);
        lastCmd = cmd;

        if (!sounding || selChanged || yChanged || octChanged || musicChanged) {
          engine.play(cmd, instrMode);
          lastNoteIdx = noteIdx;
          lastQualIdx = effectiveQualIdx;
          lastY = y;
          lastOctave = octave;
          lastMusicKey = musicKey;
        }
        sounding = true;
      } else if (sounding && engine && !sustained && !inGrace) {
        // Hand gone, not sustained, and grace expired — release the held note.
        engine.silence(instrMode);
        sounding = false;
      }

      // Rhythmic arpeggiation: turns a sustained chord into a repeating
      // pattern instead of a static drone. Only ever engages while the chord
      // is actually sustained (fist-hold or Space pedal) — plain gesture play
      // and loop mode (already returned above) are untouched. Hand height
      // sets the rate; the escape-hatch toggle falls back to a static pad.
      const arp = arpRef?.current;
      if (arp) {
        if (sustained && sounding && lastCmd && arpEnabledRef?.current !== false) {
          const rateY = left?.present ? left.y : (right?.y ?? lastY);
          arp.setChord(lastCmd.voicing);
          arp.setRate(mapYToArpBpm(rateY));
          if (!arp.running) arp.start();
        } else if (arp.running) {
          arp.stop();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      // Stopping the arp on teardown is intentional even if the ref has been
      // reassigned — it's a singleton owned by the shell, not a React node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      arpRef?.current?.stop();
    };
  }, [signalRef, modeRef, octaveRef, canvasRef, loopPlayingRef, musicRef, arpRef, arpEnabledRef]);

  useRenderer(
    canvasRef as RefObject<HTMLCanvasElement>,
    signalRef as RefObject<GestureSignal[]>,
    analyserRef,
    selectedRef,
    undefined,
    musicRef,
    ghostSignalsRef,
    guardrailRef,
  );

  function preloadSampler(m: InstrumentMode): Promise<void> {
    if (m === 'piano' && engineRef.current) {
      return engineRef.current.startLoadingSampler(m);
    }
    return Promise.resolve();
  }

  return {
    mode,
    requestCamera,
    cameraError,
    signalRef,
    // The angle-derived note/quality selection the audio path actually plays.
    // The recorder samples this (not raw x) so a recording matches what was heard.
    selectedRef,
    preloadSampler,
    vibe: 'warm' as string,
    cameraVideoRef,
    engineRef,
    sustainedRef,
  };
}
