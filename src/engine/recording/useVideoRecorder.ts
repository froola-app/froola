import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { VideoMime } from './videoRecordingStore';

export type VideoRecorderState = 'idle' | 'requesting' | 'recording';

/** A finished capture, ready to save or download. */
export interface VideoTake {
  blob: Blob;
  mime: VideoMime;
  durationMs: number;
}

const DEFAULT_MAX_DURATION_MS = 180_000; // 3 minutes

// mp4 first: it's the only container iOS Safari will play back from a share
// link, and Safari's MediaRecorder can't produce webm at all.
const MIME_CANDIDATES: { candidate: string; mime: VideoMime }[] = [
  { candidate: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', mime: 'video/mp4' },
  { candidate: 'video/mp4', mime: 'video/mp4' },
  { candidate: 'video/webm;codecs=vp8,opus', mime: 'video/webm' },
  { candidate: 'video/webm', mime: 'video/webm' },
];

// Encoding a full-retina canvas is wasted work and bandwidth — cap the
// composite; the encoder output looks identical at share sizes.
const MAX_COMPOSITE_WIDTH = 1920;

function drawWatermark(ctx2d: CanvasRenderingContext2D, w: number, h: number) {
  // Big corner wordmark (free tier). Bottom-left; the camera PiP owns the
  // bottom-right corner.
  const size = Math.round(w * 0.07);
  ctx2d.save();
  ctx2d.font = `700 ${size}px Inter, -apple-system, system-ui, sans-serif`;
  ctx2d.textBaseline = 'alphabetic';
  ctx2d.shadowColor = 'rgba(0,0,0,0.45)';
  ctx2d.shadowBlur = size * 0.15;
  ctx2d.fillStyle = 'rgba(255,255,255,0.9)';
  ctx2d.fillText('froola', Math.round(w * 0.02), h - Math.round(w * 0.02));
  ctx2d.restore();
}

export function useVideoRecorder(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraVideoRef: RefObject<HTMLVideoElement | null>,
  engineRef: RefObject<AudioEngine | null>,
  // Plan-gated (see src/entitlements.ts maxVideoRecordMs).
  maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
  // Plan-gated (recordingWatermark): free takes get the mark burned in.
  watermark: boolean = false,
) {
  const [state, setState] = useState<VideoRecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  // The finished capture. Set when the recorder stops; the owning component
  // decides what happens next (save + share, or plain download).
  const [take, setTake] = useState<VideoTake | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animIdRef = useRef<number | null>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (animIdRef.current !== null) { cancelAnimationFrame(animIdRef.current); animIdRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    stopAudioRef.current?.();
    stopAudioRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    recorderRef.current?.stop();
  }, []);

  const clearTake = useCallback(() => setTake(null), []);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setTake(null);
    setState('requesting');

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('idle');
      return;
    }
    micStreamRef.current = micStream;

    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) {
      cleanup();
      setState('idle');
      return;
    }

    // Everything past the mic prompt can throw (no supported codec, capture
    // stream refused, recorder start rejected — the Safari failure mode).
    // One catch path so the mic is never left live behind a stuck button.
    try {
      // Composite canvas: draw the Froola UI, then overlay the camera as a PiP
      // in the bottom-right corner (mirrored to match the on-screen feed). The
      // camera is always part of the frame by design — recordings show the
      // player, not just the dials.
      const srcW = canvas.width || window.innerWidth;
      const srcH = canvas.height || window.innerHeight;
      const scale = Math.min(1, MAX_COMPOSITE_WIDTH / srcW);
      const composite = document.createElement('canvas');
      composite.width = Math.round(srcW * scale);
      composite.height = Math.round(srcH * scale);
      const ctx2d = composite.getContext('2d')!;

      function drawFrame() {
        ctx2d.clearRect(0, 0, composite.width, composite.height);
        ctx2d.drawImage(canvas!, 0, 0, composite.width, composite.height);

        const camVideo = cameraVideoRef.current;
        if (camVideo && camVideo.readyState >= 2 && camVideo.videoWidth > 0) {
          const pw = Math.floor(composite.width * 0.22);
          const ph = Math.floor(pw * (camVideo.videoHeight / camVideo.videoWidth));
          const px = composite.width - pw - 16;
          const py = composite.height - ph - 16;
          // Mirror horizontally to match the CSS scaleX(-1) applied to the live feed
          ctx2d.save();
          ctx2d.translate(px + pw, py);
          ctx2d.scale(-1, 1);
          ctx2d.drawImage(camVideo, 0, 0, pw, ph);
          ctx2d.restore();
        }

        if (watermark) drawWatermark(ctx2d, composite.width, composite.height);

        animIdRef.current = requestAnimationFrame(drawFrame);
      }
      drawFrame();

      // Mix instrument + mic into one stream via the engine's own AudioContext
      const { stream: audioStream, stop: stopAudio } = engine.createRecordingStream(micStream);
      stopAudioRef.current = stopAudio;

      const videoStream = (composite as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      const picked = MIME_CANDIDATES.find(c => MediaRecorder.isTypeSupported(c.candidate))
        ?? MIME_CANDIDATES[MIME_CANDIDATES.length - 1];
      chunksRef.current = [];
      const recorder = new MediaRecorder(combined, { mimeType: picked.candidate });
      recorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
        const durationMs = performance.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: picked.mime });
        chunksRef.current = [];
        setTake({ blob, mime: picked.mime, durationMs });
        setState('idle');
        setElapsed(0);
      };

      recorder.onerror = () => {
        cleanup();
        chunksRef.current = [];
        setState('idle');
        setElapsed(0);
      };

      recorder.start(200);
      startTimeRef.current = performance.now();
      setState('recording');

      intervalRef.current = setInterval(() => {
        const secs = (performance.now() - startTimeRef.current) / 1000;
        setElapsed(secs);
        if (secs * 1000 >= maxDurationMs) stop();
      }, 100);
    } catch {
      cleanup();
      setState('idle');
    }
  }, [state, canvasRef, cameraVideoRef, engineRef, cleanup, stop, maxDurationMs, watermark]);

  return { state, elapsed, take, start, stop, clearTake };
}
