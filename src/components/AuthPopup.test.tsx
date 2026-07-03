import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AuthPopup from './AuthPopup';

const h = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
}));

vi.mock('../supabase', () => ({
  supabase: { auth: h.auth },
  supabaseConfigured: true,
}));

describe('AuthPopup', () => {
  let postMessage: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessage = vi.fn();
    vi.stubGlobal('opener', { postMessage });
    close = vi.spyOn(window, 'close').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    close.mockRestore();
  });

  it('pings the opener and closes once the session exists', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    render(<AuthPopup />);
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(postMessage).toHaveBeenCalledWith('froola:signed-in', window.location.origin);
  });

  it('also finishes when the session arrives via onAuthStateChange', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: null } });
    let fire: (session: unknown) => void = () => {};
    h.auth.onAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
      fire = s => cb('SIGNED_IN', s);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    render(<AuthPopup />);
    fire({ user: { id: 'u1' } });
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(postMessage).toHaveBeenCalledWith('froola:signed-in', window.location.origin);
  });

  it('notifies and closes only once even if both paths deliver a session', async () => {
    let fire: (session: unknown) => void = () => {};
    h.auth.onAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
      fire = s => cb('SIGNED_IN', s);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    render(<AuthPopup />);
    fire({ user: { id: 'u1' } });
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
