import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayShell from './PlayShell';
import { useCoordinator } from '../coordinator';
import { useAuth } from '../contexts/AuthContext';

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../coordinator', () => ({ useCoordinator: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const mockUseCoordinator = vi.mocked(useCoordinator);
const mockUseAuth = vi.mocked(useAuth);

function fakeEngine() {
  return {
    suspend: vi.fn(),
    resume: vi.fn(),
    audioState: vi.fn().mockReturnValue('running'),
    isSamplerReady: vi.fn().mockReturnValue(true),
    createClock: vi.fn(),
    playAt: vi.fn(),
    silence: vi.fn(),
    playNoteAt: vi.fn(),
    silenceMelody: vi.fn(),
  };
}

function coordinatorState(engine: ReturnType<typeof fakeEngine>) {
  return {
    mode: 'camera' as const,
    requestCamera: vi.fn(),
    cameraError: false,
    selectedRef: { current: { noteIdx: 0, qualIdx: 0 } },
    vibe: 'warm',
    preloadSampler: vi.fn().mockResolvedValue(undefined),
    cameraVideoRef: { current: null },
    engineRef: { current: engine },
    signalRef: { current: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCoordinator.mockReturnValue(coordinatorState(fakeEngine()));
  mockUseAuth.mockReturnValue({
    user: null,
    profile: null,
    loading: false,
    authReady: true,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
  });
});

// Froola is open source: a signed-out visitor gets the whole instrument, with
// no timer, no sign-up wall, and nothing behind a padlock.
describe('PlayShell — everything unlocked', () => {
  it('never renders a sign-up wall', () => {
    const { container } = render(<PlayShell />);
    expect(container.querySelector('.play-wall')).toBeNull();
  });

  it('offers the piano without a padlock', () => {
    render(<PlayShell />);
    const piano = screen.getByText('piano');
    expect(piano).toBeInTheDocument();
    expect(piano.textContent).not.toContain('🔒');
  });

  it('renders no upgrade sheet', () => {
    const { container } = render(<PlayShell />);
    expect(container.querySelector('.upgrade-sheet')).toBeNull();
  });
});
