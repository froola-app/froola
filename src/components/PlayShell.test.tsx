import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayShell from './PlayShell';
import { useCoordinator } from '../coordinator';
import { usePlayWall } from '../hooks/usePlayWall';
import { useAuth } from '../contexts/AuthContext';

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../coordinator', () => ({ useCoordinator: vi.fn() }));
vi.mock('../hooks/usePlayWall', () => ({ usePlayWall: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const mockUseCoordinator = vi.mocked(useCoordinator);
const mockUsePlayWall = vi.mocked(usePlayWall);
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
    mode: 'mouse' as const,
    requestCamera: vi.fn(),
    useMouse: vi.fn(),
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

describe('PlayShell — play wall wiring', () => {
  it('suspends the audio engine when usePlayWall reports gated', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(true);
    render(<PlayShell />);
    expect(engine.suspend).toHaveBeenCalled();
    expect(engine.resume).not.toHaveBeenCalled();
  });

  it('resumes the audio engine when usePlayWall reports not gated', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    render(<PlayShell />);
    expect(engine.resume).toHaveBeenCalled();
    expect(engine.suspend).not.toHaveBeenCalled();
  });

  it('passes a gatedRef reflecting usePlayWall to useCoordinator', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(true);
    render(<PlayShell />);

    const gatedRefArg = mockUseCoordinator.mock.calls[0][12];
    expect(gatedRefArg).toEqual({ current: true });
  });
});
