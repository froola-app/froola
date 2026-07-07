import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';

export type VideoRecorderState = 'idle' | 'requesting' | 'recording';

const DEFAULT_MAX_DURATION_MS = 180_000; // 3 minutes

export function useVideoRecorder(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraVideoRef: RefObject<HTMLVideoElement | null>,
  engineRef: RefObject<AudioEngine | null>,
  // Plan-gated (see src/entitlements.ts maxVideoRecordMs); Infinity on Studio.
  maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
) {
  const [state, setState] = useState<VideoRecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);

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

  const start = useCallback(async () => {
    if (state !== 'idle') return;
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
      micStream.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setState('idle');
      return;
    }

    // Composite canvas: draw the Froola UI, then overlay the camera as a PiP in
    // the bottom-right corner (mirrored to match what the user sees on screen).
    const composite = document.createElement('canvas');
    composite.width = canvas.width || window.innerWidth;
    composite.height = canvas.height || window.innerHeight;
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

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(combined, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `froola-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  }, [state, canvasRef, cameraVideoRef, engineRef, cleanup, stop, maxDurationMs]);

  return { state, elapsed, start, stop };
}
