import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayWall from './PlayWall';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: null,
    profile: null,
    loading: false,
    authReady: true,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
  });
});

describe('PlayWall', () => {
  it('renders the headline and both sign-in options', () => {
    render(<PlayWall />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /keep playing/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDefined();
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
  });

  it('renders no dismiss or close control', () => {
    render(<PlayWall />);
    expect(screen.queryByRole('button', { name: /not now/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });
});
