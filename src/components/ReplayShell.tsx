import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { GestureSignal, InstrumentMode, Recording } from '../engine/types';
import { decode } from '../engine/recording/codec';
import { sampleEndTimes, signalsAt } from '../engine/recording/replayPlayer';
import { useCoordinator } from '../coordinator';

export default function ReplayShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const replayData = searchParams.get('d');

  // Decode once. A missing or corrupt payload leaves `recording` null and we
  // fall back to the invalid-link UI below.
  const recording = useMemo<Recording | null>(() => {
    if (!replayData) return null;
    try {
      return decode(replayData);
    } catch {
      return null;
    }
  }, [replayData]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Replay always plays the recorded synth pad. The recording doesn't capture
  // the instrument, and piano needs an async sampler load, so synth keeps the
  // shared link self-contained.
  const modeRef = useRef<InstrumentMode>('synth');

  // The signal source the coordinator consumes — driven by our playback clock
  // instead of live hands. We feed it synthesised "hands" parked on the slices
  // the performer selected; the coordinator + renderer do the rest.
  const signalRef = useRef<GestureSignal[]>([]);
  // 'asking' keeps the gesture-input hook idle (no camera/mouse listeners); our
  // playback clock is the only thing that writes to signalRef.
  useCoordinator(canvasRef, modeRef, 'asking', undefined, signalRef);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1

  const ends = useMemo(() => (recording ? sampleEndTimes(recording) : []), [recording]);
  const totalMs = recording?.totalMs ?? 0;

  // Playback clock: each frame, map elapsed time → signals and publish them so
  // the coordinator (audio) and renderer (visuals) replay the performance.
  useEffect(() => {
    if (!playing || !recording) return;
    let rafId: number;
    const startMs = performance.now();

    function tick() {
      const elapsed = performance.now() - startMs;
      const canvas = canvasRef.current;
      const w = canvas?.width ?? window.innerWidth;
      const h = canvas?.height ?? window.innerHeight;

      if (elapsed >= totalMs) {
        signalRef.current = [];
        setProgress(1);
        setPlaying(false);
        return;
      }

      signalRef.current = signalsAt(recording!, ends, elapsed, w, h);
      setProgress(totalMs > 0 ? elapsed / totalMs : 1);
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      signalRef.current = [];
    };
  }, [playing, recording, ends, totalMs]);

  if (!recording) {
    return (
      <div className="landing-screen">
        <h1>Replay</h1>
        <p>This replay link is invalid.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          Play yourself →
        </button>
      </div>
    );
  }

  // Clicking Play is the user gesture that lets the AudioContext start (the
  // coordinator resumes the engine on the first pointerdown).
  const onPlay = () => {
    setProgress(0);
    setPlaying(true);
  };

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      <div className="replay-controls">
        <button className="btn-primary" onClick={onPlay}>
          {playing ? 'Playing…' : progress >= 1 ? '↻ Replay' : '▶ Play'}
        </button>
        <div className="replay-progress" aria-hidden>
          <div className="replay-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <button className="link-btn" onClick={() => navigate('/')}>
          Play yourself →
        </button>
      </div>
    </>
  );
}
