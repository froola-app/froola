import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { AuthProvider, useAuth } from './AuthContext';

const h = vi.hoisted(() => {
  const subscription = { unsubscribe: vi.fn() };
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription } })),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const maybeSingle = vi.fn();
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }));
  return { auth, from, maybeSingle };
});

vi.mock('../supabase', () => ({
  supabase: { auth: h.auth, from: h.from },
  supabaseConfigured: true,
}));

const session = {
  user: { id: 'uid-1', user_metadata: { full_name: 'Lela Star' } },
};

function Probe() {
  const { user, profile, loading, authReady } = useAuth();
  return (
    <div data-testid="probe">
      {JSON.stringify({ user, profile, loading, authReady })}
    </div>
  );
}

function probeState() {
  return JSON.parse(screen.getByTestId('probe').textContent!);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe('AuthContext (Supabase)', () => {
  it('maps a session to an AppUser with displayName and loads the profile first', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session } });
    h.maybeSingle.mockResolvedValue({
      data: { user_type: 'casual', onboarding_complete: true },
    });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(probeState().loading).toBe(false));
    expect(probeState().user).toEqual({ id: 'uid-1', displayName: 'Lela Star' });
    expect(probeState().profile).toEqual({ userType: 'casual', onboardingComplete: true });
    expect(probeState().authReady).toBe(true);
  });

  it('ends with a null user and no profile when there is no session', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(probeState().loading).toBe(false));
    expect(probeState().user).toBeNull();
    expect(probeState().profile).toBeNull();
  });

  it('signInWithGoogle opens the OAuth url in a popup', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: null } });
    h.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://oauth.example/x' },
      error: null,
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => createElement(AuthProvider, null, children),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.signInWithGoogle();
    expect(h.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `${window.location.origin}/auth/popup`,
      },
    });
    expect(openSpy).toHaveBeenCalledWith(
      'https://oauth.example/x', 'froola-signin', 'popup,width=500,height=650',
    );
    openSpy.mockRestore();
  });

  it('signInWithGoogle rejects when the popup is blocked', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: null } });
    h.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://oauth.example/x' },
      error: null,
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => createElement(AuthProvider, null, children),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.signInWithGoogle()).rejects.toThrow('popup blocked');
    openSpy.mockRestore();
  });
});
