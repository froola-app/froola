import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayShell from './PlayShell';
import { useCoordinator } from '../coordinator';
import { usePlayWall } from '../hooks/usePlayWall';
import { useAuth } from '../contexts/AuthContext';
import { listWheels } from '../engine/music/customWheelStore';

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../coordinator', () => ({ useCoordinator: vi.fn() }));
vi.mock('../hooks/usePlayWall', () => ({ usePlayWall: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../engine/music/customWheelStore', () => ({
  listWheels: vi.fn().mockResolvedValue([]),
  saveWheel: vi.fn(),
  deleteWheel: vi.fn(),
}));

const mockUseCoordinator = vi.mocked(useCoordinator);
const mockUsePlayWall = vi.mocked(usePlayWall);
const mockUseAuth = vi.mocked(useAuth);
const mockListWheels = vi.mocked(listWheels);

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

    const gatedRefArg = mockUseCoordinator.mock.calls[0][11];
    expect(gatedRefArg).toEqual({ current: true });
  });

  it('re-inserts the play wall if its DOM node is removed while gated', async () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(true);
    const { container } = render(<PlayShell />);

    const wall = container.querySelector('.play-wall');
    expect(wall).not.toBeNull();
    wall!.remove();
    expect(container.querySelector('.play-wall')).toBeNull();

    await vi.waitFor(() => {
      expect(container.querySelector('.play-wall')).not.toBeNull();
    });
  });

  it('re-inserts the play wall even when its next sibling was removed in the same batch', async () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(true);
    const { container } = render(<PlayShell />);

    const wall = container.querySelector('.play-wall')!;
    const sibling = document.createElement('div');
    wall.parentNode!.insertBefore(sibling, wall.nextSibling);

    sibling.remove();
    wall.remove();
    expect(container.querySelector('.play-wall')).toBeNull();

    await vi.waitFor(() => {
      expect(container.querySelector('.play-wall')).not.toBeNull();
    });
  });
});

describe('PlayShell — custom wheel selector gating', () => {
  it('free plan: choosing the locked wheel option opens the upgrade sheet and stays on the default wheel', async () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    // default beforeEach mock already has profile: null (free)
    render(<PlayShell />);

    const select = screen.getByLabelText('Wheel') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByText('🔒 custom wheels · plus')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '__new' } });

    expect(await screen.findByText('Build your own wheel.')).toBeInTheDocument();
    expect(select.value).toBe('');
  });

  it('does not fetch saved wheels for a free plan', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    render(<PlayShell />);
    expect(mockListWheels).not.toHaveBeenCalled();
  });

  it('plus plan: selecting "New wheel…" opens the WheelEditor dialog', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as never,
      profile: { plan: 'plus', betaTester: false } as never,
      loading: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signInWithEmail: vi.fn(),
      signOutUser: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(<PlayShell />);

    const select = screen.getByLabelText('Wheel') as HTMLSelectElement;
    expect(screen.getByText('+ new wheel…')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '__new' } });

    expect(screen.getByRole('dialog', { name: 'Custom wheel editor' })).toBeInTheDocument();
  });

  it('plus plan: loads saved wheels on mount', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as never,
      profile: { plan: 'plus', betaTester: false } as never,
      loading: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signInWithEmail: vi.fn(),
      signOutUser: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(<PlayShell />);
    expect(mockListWheels).toHaveBeenCalled();
  });
});
