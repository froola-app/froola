import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecordingsPanel from './RecordingsPanel';
import { useAuth } from '../contexts/AuthContext';
import { listRecordings, deleteRecording } from '../engine/recording/recordingStore';
import { copyToClipboard } from '../utils/clipboard';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../engine/recording/recordingStore', () => ({
  listRecordings: vi.fn(),
  deleteRecording: vi.fn(),
}));
vi.mock('../utils/clipboard', () => ({ copyToClipboard: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);
const mockListRecordings = vi.mocked(listRecordings);
const mockDeleteRecording = vi.mocked(deleteRecording);
const mockCopyToClipboard = vi.mocked(copyToClipboard);

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

const ROWS = [
  { id: 'aaa1111111', createdAt: new Date('2026-07-10T12:00:00Z').getTime(), durationMs: 12_000 },
  { id: 'bbb2222222', createdAt: new Date('2026-07-09T12:00:00Z').getTime(), durationMs: 75_000 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCopyToClipboard.mockResolvedValue(true);
});

describe('RecordingsPanel', () => {
  it('renders the sign-in note when signed out', () => {
    mockUseAuth.mockReturnValue(authState({ user: null }));
    render(<RecordingsPanel />);
    expect(screen.getByText(/sign in to keep your recordings/i)).toBeDefined();
    expect(mockListRecordings).not.toHaveBeenCalled();
  });

  it('renders rows with formatted date, duration, and slot count out of the plan cap', async () => {
    mockUseAuth.mockReturnValue(authState({
      user: { uid: 'u1', email: 'a@b.com', displayName: null } as never,
      profile: { betaTester: false, plan: 'plus' } as never,
    }));
    mockListRecordings.mockResolvedValue(ROWS);

    render(<RecordingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(new Date(ROWS[0].createdAt).toLocaleDateString())).toBeDefined();
    });

    expect(screen.getByText('0:12')).toBeDefined();
    expect(screen.getByText('1:15')).toBeDefined();
    expect(screen.getByText('2 of 3 used')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /copy link/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /delete recording/i })).toHaveLength(2);
  });

  it('copies the share link to the clipboard when Copy link is clicked', async () => {
    mockUseAuth.mockReturnValue(authState({
      user: { uid: 'u1', email: 'a@b.com', displayName: null } as never,
      profile: { betaTester: false, plan: 'plus' } as never,
    }));
    mockListRecordings.mockResolvedValue(ROWS);

    render(<RecordingsPanel />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /copy link/i })).toHaveLength(2));

    fireEvent.click(screen.getAllByRole('button', { name: /copy link/i })[0]);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(`${window.location.origin}/replay?r=${ROWS[0].id}`);
  });

  it('deletes a recording and removes its row on click', async () => {
    mockUseAuth.mockReturnValue(authState({
      user: { uid: 'u1', email: 'a@b.com', displayName: null } as never,
      profile: { betaTester: false, plan: 'plus' } as never,
    }));
    mockListRecordings.mockResolvedValue(ROWS);
    mockDeleteRecording.mockResolvedValue(true);

    render(<RecordingsPanel />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /delete recording/i })).toHaveLength(2));

    fireEvent.click(screen.getAllByRole('button', { name: /delete recording/i })[0]);

    expect(mockDeleteRecording).toHaveBeenCalledWith(ROWS[0].id);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /delete recording/i })).toHaveLength(1);
    });
    expect(screen.queryByText('2 of 3 used')).toBeNull();
    expect(screen.getByText('1 of 3 used')).toBeDefined();
  });

  it('renders "N saved" without a denominator when the plan cap is Infinity', async () => {
    mockUseAuth.mockReturnValue(authState({
      user: { uid: 'u1', email: 'a@b.com', displayName: null } as never,
      profile: { betaTester: true, plan: 'studio' } as never,
    }));
    mockListRecordings.mockResolvedValue(ROWS);

    render(<RecordingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('2 saved')).toBeDefined();
    });
  });
});
