import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { layoutFor, drawExportFrame, type ExportFormat } from './exportFrame';

export type VideoRecorderState = 'idle' | 'requesting' | 'recording' | 'done';

const DEFAULT_MAX_DURATION_MS = 180_000; // 3 minutes

export function useVideoRecorder(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraVideoRef: RefObject<HTMLVideoElement | null>,
  engineRef: RefObject<AudioEngine | null>,
  // Plan-gated (see src/entitlements.ts maxVideoRecordMs).
  maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
  // Plan-gated (replayWatermark): free downloads get "made with froola"
  // burned into the video frames.
  watermark = false,
  format: ExportFormat = '16:9',
  // Live chord label for the portrait chip; a getter so the rAF loop reads
  // the current value without re-subscribing. Omitted (or '') draws no chip.
  getChordLabel?: () => string,
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
  const blobRef = useRef<Blob | null>(null);
  const fileNameRef = useRef('');

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

    // Output dimensions are locked at start (they must match the frozen
    // composite canvas); only the portrait/square wheel SOURCE circles are
    // refreshed per frame so sampling tracks a live canvas resize. 16:9
    // stretches the whole canvas, so it needs no refresh.
    const initialLayout = layoutFor(format, canvas.width || window.innerWidth, canvas.height || window.innerHeight);
    const composite = document.createElement('canvas');
    composite.width = initialLayout.width;
    composite.height = initialLayout.height;
    const ctx2d = composite.getContext('2d')!;

    function drawFrame() {
      let layout = initialLayout;
      if (format !== '16:9') {
        const live = layoutFor(format, canvas!.width || window.innerWidth, canvas!.height || window.innerHeight);
        layout = {
          ...initialLayout,
          wheels: initialLayout.wheels!.map((w, i) => ({ src: live.wheels![i].src, dst: w.dst })),
        };
      }
      drawExportFrame(ctx2d, layout, {
        canvas: canvas!,
        camVideo: cameraVideoRef.current,
        chordLabel: getChordLabel?.() ?? '',
        watermark,
      });
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
      blobRef.current = new Blob(chunksRef.current, { type: 'video/webm' });
      fileNameRef.current = `froola-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`;
      setState('done');
    };

    recorder.start(200);
    startTimeRef.current = performance.now();
    setState('recording');

    intervalRef.current = setInterval(() => {
      const secs = (performance.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs * 1000 >= maxDurationMs) stop();
    }, 100);
  }, [state, canvasRef, cameraVideoRef, engineRef, cleanup, stop, maxDurationMs, watermark, format, getChordLabel]);

  const download = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameRef.current;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const fileForShare = useCallback((): File | null => {
    const blob = blobRef.current;
    return blob ? new File([blob], fileNameRef.current, { type: 'video/webm' }) : null;
  }, []);

  const reset = useCallback(() => {
    // Backstop against stale timers (e.g. the share-fallback "saved" flash in
    // VideoRecordButton): only a 'done' state may be reset back to idle, so
    // a late callback can't clobber a recording the user has since started.
    if (state !== 'done') return;
    blobRef.current = null;
    setState('idle');
    setElapsed(0);
  }, [state]);

  return { state, elapsed, start, stop, download, fileForShare, reset };
}
