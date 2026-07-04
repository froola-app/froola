import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupOAuthError } from './oauthCleanup';

function setUrl(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => {
  setUrl('/');
  // @ts-expect-error test cleanup — opener isn't in the lib DOM types as writable
  window.opener = null;
  vi.restoreAllMocks();
});

describe('cleanupOAuthError', () => {
  it('leaves a clean URL untouched', () => {
    setUrl('/play');
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    cleanupOAuthError();
    expect(window.location.pathname).toBe('/play');
    expect(window.location.search).toBe('');
    expect(close).not.toHaveBeenCalled();
  });

  it('closes the popup and scrubs the URL when cancelled in a popup', () => {
    setUrl('/?error=access_denied&error_description=denied');
    // @ts-expect-error simulate being the script-opened popup
    window.opener = {};
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    cleanupOAuthError();
    expect(close).toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('scrubs the error without closing when it is the main window', () => {
    setUrl('/?error=access_denied&error_description=denied');
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    cleanupOAuthError();
    expect(close).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('handles errors returned in the hash fragment', () => {
    setUrl('/#error=access_denied&error_description=denied');
    cleanupOAuthError();
    expect(window.location.hash).toBe('');
  });
});
