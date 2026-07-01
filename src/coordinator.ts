// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, InstrumentMode } from './engine/types';
import { useGestureInput, type InputMode } from './engine/input';
import { useRenderer, type DialSelection } from './engine/renderer';
import { wheelGeometry } from './engine/renderer/geometry';
import { buildCommand, DEFAULT_MUSIC, type MusicConfig } from './engine/music';
import { AudioEngine } from './engine/audio';

const REGISTER_THRESHOLD = 0.5 / 24;
// How long a chord keeps ringing after both hands briefly leave the wheels, so
// crossing the centre hub or a dropped tracking frame doesn't cut the note.
const SILENCE_GRACE_MS = 140;
// A fist must hold steady this long before it toggles sustain, so a flickering
// hand-shape detection can't stutter the hold on and off.
const FIST_DEBOUNCE_MS = 120;

export function useCoordinator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modeRef: RefObject<InstrumentMode>,
  initialMode: InputMode = 'asking',
  octaveRef?: RefObject<number>,
  // When provided, drive playback from this signal source (e.g. recorded replay)
  // instead of live hand/mouse input. The gesture-input hook still runs but its
  // signals are ignored, so live and replay share one audio/render pipeline.
  externalSignalRef?: RefObject<GestureSignal[]>,
  // Current key + scale; selects the 7 wheel notes. Defaults to C major.
  musicRef?: RefObject<MusicConfig>,
  // Optional ghost orb signals for lesson mode — translucent target-hand indicators.
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  onVolumeChange?: (v: number) => void,
) {
  const engineRef = useRef<AudioEngine | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const selectedRef = useRef<DialSelection>({ noteIdx: 0, qualIdx: 0 });
  const volumeRef = useRef(1.0);

  const input = useGestureInput(initialMode);
  const signalRef = externalSignalRef ?? input.signalRef;
  const { mode, requestCamera, useMouse, cameraVideoRef, nodEventRef } = input;

  // Pointer modes (mouse/touch) have a single pointer that can't hold the
  // extension wheel while playing the note wheel, so the chosen extension has
  // to stick. Camera mode keeps the two-hand behaviour (lift the right hand →
  // triad). A ref because the hot-path rAF loop below reads it without re-running.
  const stickyExtensionRef = useRef(mode === 'mouse');
  useEffect(() => { stickyExtensionRef.current = mode === 'mouse'; }, [mode]);

  // Create AudioEngine once; resume on first user pointer event
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    analyserRef.current = engine.getAnalyser();

    const resume = () => engine.resume();
    window.addEventListener('pointerdown', resume, { once: true });

    return () => {
      engine.suspend();
      window.removeEventListener('pointerdown', resume);
    };
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

    // Space = sustain pedal. Ignore it while a form control / button is focused
    // so it still activates them (and doesn't scroll the page).
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        t.tagName === 'BUTTON' || t.isContentEditable);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceHeld = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
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
      const { outerR, innerR, leftCx, rightCx, cy: wheelCy } = wheelGeometry(w, h);
      const inRing = (x: number, y: number, cx: number) => {
        const d = Math.hypot(x * w - cx, y * h - wheelCy);
        return d >= innerR && d <= outerR;
      };
      const leftInDial  = !!left?.present  && inRing(left.x,  left.y,  leftCx);
      const rightInDial = !!right?.present && inRing(right.x, right.y, rightCx);

      const { noteIdx, qualIdx } = selectedRef.current;
      const instrMode = modeRef.current;
      const engine = engineRef.current;
      const octave = octaveRef?.current ?? 0;
      const music = musicRef?.current ?? DEFAULT_MUSIC;
      const nowMs = performance.now();

      // Kick off sampler loading as soon as user selects piano
      if (instrMode === 'piano' && engine) {
        engine.startLoadingSampler(instrMode);
      }

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

      // Nod gesture → discrete volume step
      const nod = nodEventRef.current;
      if (nod && engine) {
        volumeRef.current = nod === 'up'
          ? Math.min(volumeRef.current + 0.1, 1.0)
          : Math.max(volumeRef.current - 0.1, 0.0);
        volumeRef.current = Math.round(volumeRef.current * 10) / 10;
        engine.setVolume(volumeRef.current);
        onVolumeChange?.(volumeRef.current);
        nodEventRef.current = null;
      }

      // Left hand on its wheel = chord plays. Right hand on its wheel modifies
      // the chord quality. If the right hand is absent, camera mode falls back
      // to a plain triad (qualIdx 0); pointer modes keep the last-dialled
      // extension (stickyExtension) since there's no second hand to hold it.
      const touching = leftInDial;
      const effectiveQualIdx = (rightInDial || stickyExtensionRef.current) ? qualIdx : 0;
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

        if (!sounding || selChanged || yChanged || octChanged || musicChanged) {
          engine.play(buildCommand(noteIdx, effectiveQualIdx, y, octave, music), instrMode);
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

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [signalRef, modeRef, octaveRef]);

  useRenderer(
    canvasRef as RefObject<HTMLCanvasElement>,
    signalRef as RefObject<GestureSignal[]>,
    analyserRef,
    selectedRef,
    undefined,
    musicRef,
    ghostSignalsRef,
    stickyExtensionRef,
  );

  function preloadSampler(m: InstrumentMode) {
    if (m === 'piano' && engineRef.current) {
      engineRef.current.startLoadingSampler(m);
    }
  }

  return {
    mode,
    requestCamera,
    useMouse,
    signalRef,
    // The angle-derived note/quality selection the audio path actually plays.
    // The recorder samples this (not raw x) so a recording matches what was heard.
    selectedRef,
    preloadSampler,
    vibe: 'warm' as string,
    cameraVideoRef,
    engineRef,
  };
}
