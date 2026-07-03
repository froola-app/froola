import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SignInPrompt, { PROMPT_DELAY_MS } from './SignInPrompt';
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
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('SignInPrompt', () => {
  it('stays hidden before the delay elapses', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS - 1000));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('appears after the delay and marks the session as prompted', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(sessionStorage.getItem('froola.signinPromptSeen')).toBe('1');
  });

  it('never appears when it was already shown this session', () => {
    sessionStorage.setItem('froola.signinPromptSeen', '1');
    mockUseAuth.mockReturnValue(authState());
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS * 2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never appears when the user is signed in', () => {
    mockUseAuth.mockReturnValue(authState({ user: { id: 'u1', displayName: 'Lela' } }));
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS * 2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never appears when auth is not configured', () => {
    mockUseAuth.mockReturnValue(authState({ authReady: false }));
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS * 2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Not now" dismisses it and it stays gone', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS * 2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Continue with Google" starts sign-in and keeps the prompt until the user lands', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authState({ signInWithGoogle }));
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledOnce();
    // popup opened ≠ signed in — prompt stays for now
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('"Continue with Google" keeps the prompt open when sign-in fails', async () => {
    const signInWithGoogle = vi.fn().mockRejectedValue(new Error('popup-blocked'));
    mockUseAuth.mockReturnValue(authState({ signInWithGoogle }));
    render(<SignInPrompt />);
    act(() => vi.advanceTimersByTime(PROMPT_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledOnce();
    await act(async () => {});
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
