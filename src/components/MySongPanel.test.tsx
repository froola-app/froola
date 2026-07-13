import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MySongPanel from './MySongPanel';
import { useAuth } from '../contexts/AuthContext';
import { getMySong, saveMySong, deleteMySong } from '../engine/songsheet';
import { listLoops } from '../engine/looper';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../engine/songsheet', async () => {
  const actual = await vi.importActual<typeof import('../engine/songsheet')>('../engine/songsheet');
  return {
    ...actual,
    getMySong: vi.fn(),
    saveMySong: vi.fn(),
    deleteMySong: vi.fn(),
  };
});
vi.mock('../engine/looper', async () => {
  const actual = await vi.importActual<typeof import('../engine/looper')>('../engine/looper');
  return { ...actual, listLoops: vi.fn() };
});

const mockUseAuth = vi.mocked(useAuth);
const mockGetMySong = vi.mocked(getMySong);
const mockSaveMySong = vi.mocked(saveMySong);
const mockDeleteMySong = vi.mocked(deleteMySong);
const mockListLoops = vi.mocked(listLoops);

function authState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    user: { uid: 'u1', email: 'a@b.com', displayName: null } as never,
    profile: { betaTester: false, plan: 'plus' } as never,
    loading: false,
    authReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
    ...overrides,
  };
}

const SHEET_SOURCE = 'C       G\nHello there';

const SAVED_SONG = {
  title: 'My Tune',
  sheetSource: SHEET_SOURCE,
  loops: [
    { name: 'verse', bpm: 90, beatsPerSlot: 4, slots: [], savedAt: 1 },
  ],
  updatedAt: 123,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(authState());
  mockListLoops.mockReturnValue([]);
});

describe('MySongPanel', () => {
  it('renders the import form when there is no saved song', async () => {
    mockGetMySong.mockResolvedValue(null);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/title/i)).toBeDefined();
    });
    expect(screen.getByPlaceholderText(/lyrics/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /import/i })).toBeDefined();
  });

  it('imports the pasted source and switches to the sheet view', async () => {
    mockGetMySong.mockResolvedValue(null);
    mockSaveMySong.mockResolvedValue(true);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/title/i)).toBeDefined());

    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'My Tune' } });
    fireEvent.change(screen.getByPlaceholderText(/lyrics/i), { target: { value: SHEET_SOURCE } });
    fireEvent.click(screen.getByRole('button', { name: /import/i }));

    await waitFor(() => {
      expect(mockSaveMySong).toHaveBeenCalledWith({ title: 'My Tune', sheetSource: SHEET_SOURCE, loops: [] });
    });
    await waitFor(() => {
      expect(screen.getByText('My Tune')).toBeDefined();
    });
    expect(document.querySelectorAll('.sheet-chord').length).toBeGreaterThan(0);
  });

  it('renders the parsed sheet with chord spans for a saved song', async () => {
    mockGetMySong.mockResolvedValue(SAVED_SONG);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('My Tune')).toBeDefined();
    });
    const chords = document.querySelectorAll('.sheet-chord');
    expect(chords.length).toBeGreaterThan(0);
    expect(Array.from(chords).some(c => c.textContent === 'C')).toBe(true);
  });

  it('stores current loops by copying listLoops() into saveMySong', async () => {
    mockGetMySong.mockResolvedValue(SAVED_SONG);
    mockSaveMySong.mockResolvedValue(true);
    const loops = [{ name: 'chorus', bpm: 100, beatsPerSlot: 2, slots: [], savedAt: 2 }];
    mockListLoops.mockReturnValue(loops);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Tune')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /store current loops/i }));

    await waitFor(() => {
      expect(mockSaveMySong).toHaveBeenCalledWith({
        title: SAVED_SONG.title,
        sheetSource: SAVED_SONG.sheetSource,
        loops,
      });
    });
  });

  it('calls onLoadLoop when a stored loop row Load button is clicked', async () => {
    mockGetMySong.mockResolvedValue(SAVED_SONG);
    const onLoadLoop = vi.fn();
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={onLoadLoop} />);

    await waitFor(() => expect(screen.getByText('verse')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }));

    expect(onLoadLoop).toHaveBeenCalledWith(SAVED_SONG.loops[0]);
  });

  it('deletes the song after confirm and returns to the import form', async () => {
    mockGetMySong.mockResolvedValue(SAVED_SONG);
    mockDeleteMySong.mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Tune')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /delete song/i }));

    expect(window.confirm).toHaveBeenCalledWith('Delete your song? This frees your one import.');
    await waitFor(() => {
      expect(mockDeleteMySong).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/title/i)).toBeDefined();
    });
  });

  it('does not delete when confirm is declined', async () => {
    mockGetMySong.mockResolvedValue(SAVED_SONG);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MySongPanel open onClose={vi.fn()} onLoadLoop={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Tune')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /delete song/i }));

    expect(mockDeleteMySong).not.toHaveBeenCalled();
    expect(screen.getByText('My Tune')).toBeDefined();
  });

  it('does not fetch when closed', () => {
    render(<MySongPanel open={false} onClose={vi.fn()} onLoadLoop={vi.fn()} />);
    expect(mockGetMySong).not.toHaveBeenCalled();
  });
});
