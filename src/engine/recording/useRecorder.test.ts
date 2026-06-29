import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import type { DialSelection } from '../renderer';
import { useRecorder } from './useRecorder';

function makeRef(sel: DialSelection = { noteIdx: 0, qualIdx: 0 }): RefObject<DialSelection> {
  return { current: sel };
}

describe('useRecorder', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsed).toBe(0);
    expect(result.current.shareUrl).toBeNull();
  });

  it('transitions to recording on start()', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
  });

  it('transitions to done on stop() and sets shareUrl', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.shareUrl).toMatch(/\/replay\?d=/);
  });

  it('shareUrl contains a non-empty base64url payload', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    const url = result.current.shareUrl!;
    const d = new URL(url).searchParams.get('d');
    expect(d).toBeTruthy();
  });

  it('can start again after done', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
    expect(result.current.shareUrl).toBeNull();
  });
});
