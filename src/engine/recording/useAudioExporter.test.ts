import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { useAudioExporter } from './useAudioExporter';
import { encodeMp3 } from './mp3';
import { saveMp3 } from './mp3Store';

vi.mock('./mp3', () => ({
  encodeMp3: vi.fn(() => new Blob(['mp3-bytes'], { type: 'audio/mpeg' })),
}));

vi.mock('./mp3Store', () => ({
  saveMp3: vi.fn().mockResolvedValue('mp3-id-1'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// jsdom has no MediaRecorder implementation — a small controllable fake that
// mirrors the bits useAudioExporter touches (start/stop, ondataavailable/onstop).
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MediaStream, public opts?: MediaRecorderOptions) {
    FakeMediaRecorder.instances.push(this);
  }
  start = vi.fn();
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'audio/webm' }) });
    this.onstop?.();
  });
}

function makeEngineRef(): RefObject<AudioEngine | null> {
  const stopAudio = vi.fn();
  const engine = {
    createInstrumentStream: vi.fn(() => ({ stream: {} as MediaStream, stop: stopAudio })),
    decodeAudio: vi.fn().mockResolvedValue({ numberOfChannels: 2, sampleRate: 44100, length: 0, getChannelData: () => new Float32Array(0) }),
  } as unknown as AudioEngine;
  return { current: engine };
}

describe('useAudioExporter', () => {
  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useAudioExporter(makeEngineRef()));
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsed).toBe(0);
  });

  it('transitions to recording on start()', () => {
    const { result } = renderHook(() => useAudioExporter(makeEngineRef()));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
  });

  it('transitions recording -> encoding -> idle on stop(), saving via mp3Store', async () => {
    const engineRef = makeEngineRef();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { result } = renderHook(() => useAudioExporter(engineRef));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    // onstop sets 'encoding' synchronously, then the async pipeline resolves.
    expect(result.current.state).toBe('encoding');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(engineRef.current!.decodeAudio).toHaveBeenCalledOnce();
    expect(encodeMp3).toHaveBeenCalledOnce();
    expect(saveMp3).toHaveBeenCalledOnce();
    expect(saveMp3).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number));
    expect(result.current.state).toBe('idle');
    expect(clickSpy).not.toHaveBeenCalled(); // no more auto-download
    clickSpy.mockRestore();
  });

  it('bumps saveTick once the save settles', async () => {
    const engineRef = makeEngineRef();
    const { result } = renderHook(() => useAudioExporter(engineRef));
    expect(result.current.saveTick).toBe(0);
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.saveTick).toBe(1);
  });

  it('falls back to no mimeType option when audio/webm is unsupported', () => {
    FakeMediaRecorder.isTypeSupported = vi.fn(() => false);
    const engineRef = makeEngineRef();
    const { result } = renderHook(() => useAudioExporter(engineRef));
    expect(() => act(() => { result.current.start(); })).not.toThrow();
    expect(result.current.state).toBe('recording');
    const instance = FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1];
    expect(instance.opts).toBeUndefined();
  });

  it('returns to idle if decodeAudio rejects', async () => {
    const engineRef = makeEngineRef();
    (engineRef.current!.decodeAudio as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('decode failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAudioExporter(engineRef));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('encoding');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.state).toBe('idle');
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('auto-stops when elapsed reaches maxDurationMs', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    try {
      const engineRef = makeEngineRef();
      const { result } = renderHook(() => useAudioExporter(engineRef, 5_000));
      act(() => { result.current.start(); });
      act(() => { vi.advanceTimersByTime(4_900); });
      expect(result.current.state).toBe('recording');
      act(() => { vi.advanceTimersByTime(1_000); });
      expect(result.current.state).toBe('encoding');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing if engineRef is empty', () => {
    const engineRef: RefObject<AudioEngine | null> = { current: null };
    const { result } = renderHook(() => useAudioExporter(engineRef));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('idle');
  });
});
