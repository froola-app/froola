import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayWall, TIMER_MS, TRIGGERED_KEY } from './usePlayWall';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

function authState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    user: null,
    profile: null,
    loading: false,
    authReady: true,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('usePlayWall', () => {
  it('stays false before the timer elapses', () => {
    mockUseAuth.mockReturnValue(authState());
    const { result } = renderHook(() => usePlayWall(true));
    act(() => vi.advanceTimersByTime(TIMER_MS - 1000));
    expect(result.current).toBe(false);
  });

  it('gates after the timer elapses and persists the trigger', () => {
    mockUseAuth.mockReturnValue(authState());
    const { result } = renderHook(() => usePlayWall(true));
    act(() => vi.advanceTimersByTime(TIMER_MS));
    expect(result.current).toBe(true);
    expect(localStorage.getItem(TRIGGERED_KEY)).toBe('1');
  });

  it('never starts the timer while inactive', () => {
    mockUseAuth.mockReturnValue(authState());
    const { result } = renderHook(() => usePlayWall(false));
    act(() => vi.advanceTimersByTime(TIMER_MS * 2));
    expect(result.current).toBe(false);
  });

  it('never gates a signed-in user, even after the timer would fire', () => {
    mockUseAuth.mockReturnValue(authState({ user: { id: 'u1', displayName: 'Lela', email: null, avatarUrl: null } }));
    const { result } = renderHook(() => usePlayWall(true));
    act(() => vi.advanceTimersByTime(TIMER_MS));
    expect(result.current).toBe(false);
  });

  it('never gates when auth is not configured', () => {
    mockUseAuth.mockReturnValue(authState({ authReady: false }));
    const { result } = renderHook(() => usePlayWall(true));
    act(() => vi.advanceTimersByTime(TIMER_MS));
    expect(result.current).toBe(false);
  });

  it('gates immediately on mount when the browser already triggered it before', () => {
    localStorage.setItem(TRIGGERED_KEY, '1');
    mockUseAuth.mockReturnValue(authState());
    const { result } = renderHook(() => usePlayWall(true));
    expect(result.current).toBe(true);
  });

  it('does not gate a returning signed-in user even if the flag is set', () => {
    localStorage.setItem(TRIGGERED_KEY, '1');
    mockUseAuth.mockReturnValue(authState({ user: { id: 'u1', displayName: 'Lela', email: null, avatarUrl: null } }));
    const { result } = renderHook(() => usePlayWall(true));
    expect(result.current).toBe(false);
  });

  it('stays false while the initial auth check is loading', () => {
    localStorage.setItem(TRIGGERED_KEY, '1');
    mockUseAuth.mockReturnValue(authState({ loading: true }));
    const { result } = renderHook(() => usePlayWall(true));
    expect(result.current).toBe(false);
  });
});
