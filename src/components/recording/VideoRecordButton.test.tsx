import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoRecordButton from './VideoRecordButton';
import { useVideoRecorder } from '../../engine/recording/useVideoRecorder';

vi.mock('../../engine/recording/useVideoRecorder', () => ({ useVideoRecorder: vi.fn() }));
vi.mock('./clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));
import { copyToClipboard } from './clipboard';

const mockHook = vi.mocked(useVideoRecorder);

function hookState(overrides = {}) {
  return {
    state: 'idle' as const, elapsed: 0,
    start: vi.fn(), stop: vi.fn(), download: vi.fn(),
    fileForShare: vi.fn().mockReturnValue(new File(['x'], 'froola.webm', { type: 'video/webm' })),
    reset: vi.fn(),
    ...overrides,
  };
}

const props = {
  canvasRef: { current: null }, cameraVideoRef: { current: null },
  engineRef: { current: null }, maxDurationMs: 20000,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // jsdom has no navigator.share/canShare by default
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
});

describe('format toggle', () => {
  it('defaults to 9:16 and persists a change', () => {
    mockHook.mockReturnValue(hookState());
    render(<VideoRecordButton {...props} />);
    expect(screen.getByRole('radio', { name: '9:16' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '1:1' }));
    expect(localStorage.getItem('froola.exportFormat')).toBe('1:1');
    expect(screen.getByRole('radio', { name: '1:1' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reads a stored format and passes it to the hook', () => {
    localStorage.setItem('froola.exportFormat', '16:9');
    mockHook.mockReturnValue(hookState());
    render(<VideoRecordButton {...props} />);
    expect(screen.getByRole('radio', { name: '16:9' })).toHaveAttribute('aria-checked', 'true');
    expect(mockHook).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      20000, false, '16:9', undefined,
    );
  });

  it('ignores garbage in localStorage', () => {
    localStorage.setItem('froola.exportFormat', '4:3');
    mockHook.mockReturnValue(hookState());
    render(<VideoRecordButton {...props} />);
    expect(screen.getByRole('radio', { name: '9:16' })).toHaveAttribute('aria-checked', 'true');
  });

  it('is disabled while recording', () => {
    mockHook.mockReturnValue(hookState({ state: 'recording', elapsed: 3 }));
    render(<VideoRecordButton {...props} />);
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled();
  });

  it('is hidden when locked', () => {
    mockHook.mockReturnValue(hookState());
    render(<VideoRecordButton {...props} locked onLockedClick={() => {}} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('done state', () => {
  it('shares via navigator.share when supported, then resets', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { canShare: vi.fn().mockReturnValue(true), share });
    const h = hookState({ state: 'done' });
    mockHook.mockReturnValue(h);
    render(<VideoRecordButton {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /share video/i }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      text: 'made with froola · froolamusic.com',
    }));
    await waitFor(() => expect(h.reset).toHaveBeenCalled());
  });

  it('stays in done state when the user cancels the share sheet', async () => {
    Object.assign(navigator, {
      canShare: vi.fn().mockReturnValue(true),
      share: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')),
    });
    const h = hookState({ state: 'done' });
    mockHook.mockReturnValue(h);
    render(<VideoRecordButton {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /share video/i }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(h.reset).not.toHaveBeenCalled();
  });

  it('falls back to download + caption copy without navigator.share', async () => {
    const h = hookState({ state: 'done' });
    mockHook.mockReturnValue(h);
    render(<VideoRecordButton {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /share video/i }));
    await waitFor(() => expect(h.download).toHaveBeenCalled());
    expect(copyToClipboard).toHaveBeenCalledWith('made with froola · froolamusic.com');
    expect(await screen.findByText(/saved · caption copied/i)).toBeInTheDocument();
  });

  it('offers a plain download secondary action', () => {
    const h = hookState({ state: 'done' });
    mockHook.mockReturnValue(h);
    render(<VideoRecordButton {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /download video/i }));
    expect(h.download).toHaveBeenCalled();
    expect(h.reset).toHaveBeenCalled();
  });
});
