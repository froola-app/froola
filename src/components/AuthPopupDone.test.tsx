import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPopupDone from './AuthPopupDone';

const h = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(),
  };
  return { auth };
});

vi.mock('../supabase', () => ({
  supabase: { auth: h.auth },
  supabaseConfigured: true,
}));

const session = {
  user: { id: 'uid-1', user_metadata: { full_name: 'Lela Star' } },
};

describe('AuthPopupDone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies the opener and closes the popup on successful session', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session } });
    const postMessageSpy = vi.fn();
    const closeSpy = vi.fn();
    vi.stubGlobal('opener', { postMessage: postMessageSpy });
    const closeStub = vi.spyOn(window, 'close').mockImplementation(closeSpy);

    render(<MemoryRouter><AuthPopupDone /></MemoryRouter>);

    await waitFor(() => expect(postMessageSpy).toHaveBeenCalledWith(
      'froola:signed-in', window.location.origin,
    ));
    expect(closeSpy).toHaveBeenCalled();

    closeStub.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not throw and does nothing destructive when window.opener is null', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session } });
    vi.stubGlobal('opener', null);
    const closeSpy = vi.fn();
    const closeStub = vi.spyOn(window, 'close').mockImplementation(closeSpy);

    expect(() => render(<MemoryRouter><AuthPopupDone /></MemoryRouter>)).not.toThrow();

    expect(h.auth.getSession).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();

    closeStub.mockRestore();
    vi.unstubAllGlobals();
  });
});
