import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { User } from 'firebase/auth';
import AuthButton from './AuthButton';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

function authState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    user: null,
    profile: null,
    loading: false,
    firebaseReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('AuthButton', () => {
  it('renders nothing when Firebase is not configured', () => {
    mockUseAuth.mockReturnValue(authState({ firebaseReady: false }));
    const { container } = render(<AuthButton />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a sign-in button when signed out and calls signInWithGoogle', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authState({ signInWithGoogle }));
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });

  it('shows the first name when signed in, with a sign-out action behind it', () => {
    const signOutUser = vi.fn();
    mockUseAuth.mockReturnValue(authState({
      user: { displayName: 'Lela Star' } as User,
      signOutUser,
    }));
    render(<AuthButton />);
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lela' }));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOutUser).toHaveBeenCalledOnce();
  });

  it('falls back to "Account" when the user has no display name', () => {
    mockUseAuth.mockReturnValue(authState({ user: { displayName: null } as User }));
    render(<AuthButton />);
    expect(screen.getByRole('button', { name: 'Account' })).toBeDefined();
  });
});
