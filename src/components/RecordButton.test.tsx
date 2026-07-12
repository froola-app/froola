import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import RecordButton from './RecordButton';
import { listRecordings, saveRecordingCapped } from '../engine/recording/recordingStore';

vi.mock('../engine/recording/recordingStore', () => ({
  listRecordings: vi.fn().mockResolvedValue([]),
  saveRecordingCapped: vi.fn().mockResolvedValue(null),
}));

function Harness({ maxSavedRecordings = Infinity }: { maxSavedRecordings?: number }) {
  const selectedRef = useRef({ noteIdx: 0, qualIdx: 0 });
  return <RecordButton selectedRef={selectedRef} vibe="warm" maxSavedRecordings={maxSavedRecordings} />;
}

describe('RecordButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRecordings).mockResolvedValue([]);
  });
  it('shows Rec in idle state', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /rec/i })).toBeInTheDocument();
  });

  it('shows Stop after clicking Rec', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows Share after clicking Stop', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('copies shareUrl on Share click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/replay\?d=/)
    );
  });

  it('locked: shows the plus teaser and fires onLockedClick instead of recording', async () => {
    const onLockedClick = vi.fn();
    function LockedHarness() {
      const selectedRef = useRef({ noteIdx: 0, qualIdx: 0 });
      return <RecordButton selectedRef={selectedRef} vibe="warm" maxSavedRecordings={Infinity} locked onLockedClick={onLockedClick} />;
    }
    render(<LockedHarness />);
    const btn = screen.getByRole('button', { name: /record/i });
    expect(btn.textContent).toMatch(/plus/i);
    await userEvent.click(btn);
    expect(onLockedClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
  });

  it('confirms replacement before starting when held count meets the cap', async () => {
    vi.mocked(listRecordings).mockResolvedValue([
      { id: 'a', createdAt: 1, durationMs: 1000 },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness maxSavedRecordings={1} />);
    await waitFor(() => expect(listRecordings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('old link will stop working')
    );
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('does not start recording when the replace confirm is declined', async () => {
    vi.mocked(listRecordings).mockResolvedValue([
      { id: 'a', createdAt: 1, durationMs: 1000 },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness maxSavedRecordings={1} />);
    await waitFor(() => expect(listRecordings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('does not confirm when held count is below the cap', async () => {
    vi.mocked(listRecordings).mockResolvedValue([]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness maxSavedRecordings={1} />);
    await waitFor(() => expect(listRecordings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('re-fetches held count once the save settles, so the next Record click confirms', async () => {
    let resolveSave!: (id: string | null) => void;
    vi.mocked(saveRecordingCapped).mockReturnValueOnce(
      new Promise(resolve => { resolveSave = resolve; })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { unmount } = render(<Harness maxSavedRecordings={1} />);
    await waitFor(() => expect(listRecordings).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));

    // Save hasn't settled yet — held count should still reflect the
    // pre-save state, so listRecordings shouldn't have been re-fetched.
    expect(listRecordings).toHaveBeenCalledTimes(1);

    vi.mocked(listRecordings).mockResolvedValue([
      { id: 'a', createdAt: 1, durationMs: 1000 },
    ]);
    resolveSave('new-id');
    await waitFor(() => expect(listRecordings).toHaveBeenCalledTimes(2));

    // Re-mount to return to idle (this RecordButton instance has no
    // in-place "record again" affordance in 'done' state) and confirm the
    // now-settled held count of 1 correctly triggers the replace confirm
    // on the very next Record click, instead of the stale pre-save count.
    unmount();
    render(<Harness maxSavedRecordings={1} />);
    await waitFor(() => expect(listRecordings).toHaveBeenCalledTimes(3));

    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('old link will stop working')
    );
    confirmSpy.mockRestore();
  });
});
