import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileSidebar from './ProfileSidebar';
import { useAuth } from '../contexts/AuthContext';
import { getVisualTheme, setVisualTheme } from '../engine/renderer/themes';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

function authState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    user: null,
    profile: null,
    loading: false,
    authReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setVisualTheme('froola');
});

describe('ProfileSidebar — email magic-link sign-in', () => {
  it('does not render the email form when auth is not configured', () => {
    mockUseAuth.mockReturnValue(authState({ authReady: false }));
    render(<ProfileSidebar open onClose={() => {}} />);
    expect(screen.queryByLabelText(/email address/i)).toBeNull();
  });

  it('renders the email form alongside Google when signed out', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<ProfileSidebar open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDefined();
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeDefined();
  });

  it('sends a magic link and shows the sent confirmation', async () => {
    const signInWithEmail = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authState({ signInWithEmail }));
    render(<ProfileSidebar open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'lela@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    expect(signInWithEmail).toHaveBeenCalledWith('lela@example.com');
    await waitFor(() => {
      expect(screen.getByText(/check your email for a sign-in link/i)).toBeDefined();
    });
    expect(screen.queryByLabelText(/email address/i)).toBeNull();
  });

  it('shows an inline error and keeps the form when signInWithEmail rejects', async () => {
    const signInWithEmail = vi.fn().mockRejectedValue(new Error('rate limited'));
    mockUseAuth.mockReturnValue(authState({ signInWithEmail }));
    render(<ProfileSidebar open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'lela@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByText(/couldn't send the link/i)).toBeDefined();
    });
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send magic link/i })).not.toBeDisabled();
  });
});

describe('ProfileSidebar — looks', () => {
  it('lets a signed-out visitor pick any look', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<ProfileSidebar open onClose={() => {}} />);

    expect(screen.getByText('Looks')).toBeDefined();
    expect(screen.getByRole('button', { name: 'froola' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/unlock all looks/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'neon' }));
    expect(getVisualTheme().id).toBe('neon');
  });

  it('changes the live renderer palette', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<ProfileSidebar open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'ocean' }));
    expect(getVisualTheme().id).toBe('ocean');
    expect(screen.getByRole('button', { name: 'ocean' })).toHaveAttribute('aria-pressed', 'true');
  });
});
