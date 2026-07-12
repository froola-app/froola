import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { encodeMp3 } from './mp3';

export type AudioExporterState = 'idle' | 'recording' | 'encoding';

const DEFAULT_MAX_DURATION_MS = 180_000; // 3 minutes

export function useAudioExporter(
  engineRef: RefObject<AudioEngine | null>,
  // Plan-gated (see src/entitlements.ts maxVideoRecordMs) — audio export
  // shares the video recorder's length cap.
  maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
) {
  const [state, setState] = useState<AudioExporterState>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    stopAudioRef.current?.();
    stopAudioRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (state !== 'idle') return;
    const engine = engineRef.current;
    if (!engine) return;

    const { stream, stop: stopAudio } = engine.createInstrumentStream();
    stopAudioRef.current = stopAudio;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorderRef.current = recorder;

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      cleanup();
      setState('encoding');
      void (async () => {
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioBuffer = await engine.decodeAudio(arrayBuffer);
        const mp3Blob = encodeMp3(audioBuffer);
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'froola-session.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setState('idle');
        setElapsed(0);
      })();
    };

    recorder.start(200);
    startTimeRef.current = performance.now();
    setState('recording');

    intervalRef.current = setInterval(() => {
      const secs = (performance.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs * 1000 >= maxDurationMs) stop();
    }, 100);
  }, [state, engineRef, cleanup, stop, maxDurationMs]);

  return { state, elapsed, start, stop };
}
