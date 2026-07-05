import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileButton from './ProfileButton';
import { initialsOf } from './Avatar';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

// The sidebar's Plan row renders a react-router Link when on the free plan.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

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

function user(overrides: Partial<NonNullable<ReturnType<typeof useAuth>['user']>> = {}) {
  return {
    id: 'u1',
    displayName: 'Lela Star',
    email: 'lela@example.com',
    avatarUrl: null,
    ...overrides,
  };
}

const openSidebar = () => fireEvent.click(screen.getByRole('button', { name: /settings/i }));

beforeEach(() => vi.clearAllMocks());

describe('initialsOf', () => {
  it('takes first and last initials, uppercased', () => {
    expect(initialsOf('Lela Star')).toBe('LS');
    expect(initialsOf('lela')).toBe('L');
    expect(initialsOf('  Lela   del  Star  ')).toBe('LS');
    expect(initialsOf(null)).toBeNull();
    expect(initialsOf('   ')).toBeNull();
  });
});

describe('ProfileButton', () => {
  it('renders even when auth is not configured, and its sidebar hides the Google button', () => {
    mockUseAuth.mockReturnValue(authState({ authReady: false }));
    render(<ProfileButton />);
    openSidebar();
    expect(screen.getByRole('dialog', { name: /account and settings/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
  });

  it('signed out: silhouette button, sidebar offers Google sign-in', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authState({ signInWithGoogle }));
    render(<ProfileButton />);
    expect(screen.getByRole('button', { name: 'Sign in and settings' })).toBeDefined();
    openSidebar();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });

  it('signed in with a photo: renders the avatar image', () => {
    mockUseAuth.mockReturnValue(authState({
      user: user({ avatarUrl: 'https://lh3.example.com/g.jpg' }),
    }));
    render(<ProfileButton />);
    const imgs = document.querySelectorAll('img.avatar__img');
    expect(imgs.length).toBeGreaterThan(0);
    expect((imgs[0] as HTMLImageElement).src).toBe('https://lh3.example.com/g.jpg');
  });

  it('a custom profile photo overrides the Google one', () => {
    mockUseAuth.mockReturnValue(authState({
      user: user({ avatarUrl: 'https://lh3.example.com/g.jpg' }),
      profile: { userType: 'casual', onboardingComplete: true, avatarUrl: 'https://cdn.froola/custom.png' },
    }));
    render(<ProfileButton />);
    const img = document.querySelector('img.avatar__img') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.froola/custom.png');
  });

  it('falls back to initials when the photo fails to load', () => {
    mockUseAuth.mockReturnValue(authState({
      user: user({ avatarUrl: 'https://dead.example.com/x.jpg' }),
    }));
    render(<ProfileButton />);
    fireEvent.error(document.querySelector('img.avatar__img')!);
    expect(screen.getAllByText('LS').length).toBeGreaterThan(0);
  });

  it('shows initials when there is no photo at all', () => {
    mockUseAuth.mockReturnValue(authState({ user: user() }));
    render(<ProfileButton />);
    expect(screen.getAllByText('LS').length).toBeGreaterThan(0);
  });

  it('shows name and email in the sidebar header and signs out from the Account section', () => {
    const signOutUser = vi.fn();
    mockUseAuth.mockReturnValue(authState({ user: user(), signOutUser }));
    render(<ProfileButton />);
    openSidebar();
    expect(screen.getByText('Lela Star')).toBeDefined();
    expect(screen.getAllByText('lela@example.com').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOutUser).toHaveBeenCalledOnce();
  });

  it('closes on Escape and on the scrim', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<ProfileButton />);
    openSidebar();
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    openSidebar();
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(document.querySelector('.profile-drawer-scrim')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Settings section shows the theme row, plus play rows when play actions are passed', () => {
    mockUseAuth.mockReturnValue(authState());
    const onSwitchInput = vi.fn();
    const onReplayTutorial = vi.fn();
    render(
      <ProfileButton
        play={{ inputMode: 'camera', onSwitchInput, onReplayTutorial }}
      />,
    );
    openSidebar();
    expect(screen.getByText('Theme')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /use mouse/i }));
    expect(onSwitchInput).toHaveBeenCalledOnce();
    // acting on a play row also closes the drawer
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Settings section hides play rows when no play actions are passed', () => {
    mockUseAuth.mockReturnValue(authState());
    render(<ProfileButton />);
    openSidebar();
    expect(screen.getByText('Theme')).toBeDefined();
    expect(screen.queryByText('Input')).toBeNull();
    expect(screen.queryByRole('button', { name: /replay/i })).toBeNull();
  });
});
