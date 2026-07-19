import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react';
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
vi.mock('./recording/VideoRecordButton', () => ({
  default: vi.fn(() => <div data-testid="video-record-button" />),
}));

const mockUseCoordinator = vi.mocked(useCoordinator);
const mockUsePlayWall = vi.mocked(usePlayWall);
const mockUseAuth = vi.mocked(useAuth);
const mockListWheels = vi.mocked(listWheels);

// Import the mock to check props passed to it
import VideoRecordButton from './recording/VideoRecordButton';
const mockVideoRecordButton = vi.mocked(VideoRecordButton);

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

function coordinatorState(engine: ReturnType<typeof fakeEngine>, sustainedRef: { current: boolean } = { current: false }) {
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
    sustainedRef,
  };
}

const plusAuthState = {
  user: { uid: 'u1' } as never,
  profile: { plan: 'plus', betaTester: false } as never,
  loading: false,
  authReady: true,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signOutUser: vi.fn(),
  completeOnboarding: vi.fn(),
};

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

describe('PlayShell — octave keydown guard', () => {
  it('ignores ArrowUp/ArrowDown while a text field is focused (e.g. the My Song textarea)', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    render(<PlayShell />);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    fireEvent.keyDown(textarea, { key: 'ArrowUp' });

    expect(screen.getByText('oct 0')).toBeInTheDocument();

    document.body.removeChild(textarea);
  });

  it('changes the octave on ArrowUp/ArrowDown when no control is focused', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    render(<PlayShell />);

    fireEvent.keyDown(document.body, { key: 'ArrowUp' });

    expect(screen.getByText('oct +1')).toBeInTheDocument();
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

  it('downgrade mid-session clears the active custom wheel and the loaded list', async () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    const plusAuth = {
      user: { uid: 'u1' } as never,
      profile: { plan: 'plus', betaTester: false } as never,
      loading: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signInWithEmail: vi.fn(),
      signOutUser: vi.fn(),
      completeOnboarding: vi.fn(),
    };
    mockUseAuth.mockReturnValue(plusAuth);
    const wheel = {
      id: 'w1',
      name: 'My Wheel',
      slices: Array.from({ length: 7 }, (_, i) => ({ interval: i, quality: 'maj' as const })),
    };
    mockListWheels.mockResolvedValue([wheel]);
    const { rerender } = render(<PlayShell />);

    const select = screen.getByLabelText('Wheel') as HTMLSelectElement;
    expect(await screen.findByText('My Wheel')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'w1' } });
    expect(select.value).toBe('w1');

    // Plan lapses / sign-out: entitlements flip and the gated wheel must go.
    mockUseAuth.mockReturnValue({ ...plusAuth, user: null, profile: null });
    rerender(<PlayShell />);

    expect(select.value).toBe('');
    expect(screen.queryByText('My Wheel')).not.toBeInTheDocument();
  });
});

describe('PlayShell — MP4 export watermark by plan', () => {
  it('plus plan: video record button receives watermark true (burned into exports)', () => {
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

    const lastCall = mockVideoRecordButton.mock.calls[mockVideoRecordButton.mock.calls.length - 1];
    expect(lastCall[0].watermark).toBe(true);
  });

  it('studio plan: video record button receives watermark false (clean exports)', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUsePlayWall.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as never,
      profile: { plan: 'studio', betaTester: false } as never,
      loading: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signInWithEmail: vi.fn(),
      signOutUser: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(<PlayShell />);

    const lastCall = mockVideoRecordButton.mock.calls[mockVideoRecordButton.mock.calls.length - 1];
    expect(lastCall[0].watermark).toBe(false);
  });
});

describe('PlayShell — record-arm rising-edge capture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function armButton() {
    return screen.getByRole('button', { name: /arm/i });
  }

  function slotCount() {
    return document.querySelectorAll('.loop-slot').length;
  }

  it('does not capture when arming while the fist is already sustained', () => {
    const engine = fakeEngine();
    const sustainedRef = { current: true };
    mockUseCoordinator.mockReturnValue(coordinatorState(engine, sustainedRef));
    mockUsePlayWall.mockReturnValue(false);
    mockUseAuth.mockReturnValue(plusAuthState);
    render(<PlayShell />);

    fireEvent.click(armButton());
    act(() => { vi.advanceTimersByTime(500); });

    expect(slotCount()).toBe(0);
  });

  it('captures exactly once per rising edge while armed', () => {
    const engine = fakeEngine();
    const sustainedRef = { current: false };
    mockUseCoordinator.mockReturnValue(coordinatorState(engine, sustainedRef));
    mockUsePlayWall.mockReturnValue(false);
    mockUseAuth.mockReturnValue(plusAuthState);
    render(<PlayShell />);

    fireEvent.click(armButton());

    // Rising edge: false -> true captures once.
    sustainedRef.current = true;
    act(() => { vi.advanceTimersByTime(100); });
    expect(slotCount()).toBe(1);

    // Still held: no further capture.
    act(() => { vi.advanceTimersByTime(300); });
    expect(slotCount()).toBe(1);

    // Release then squeeze again: a second rising edge captures again.
    sustainedRef.current = false;
    act(() => { vi.advanceTimersByTime(100); });
    sustainedRef.current = true;
    act(() => { vi.advanceTimersByTime(100); });
    expect(slotCount()).toBe(2);
  });

  it('auto-disarms once the loop fills to the plan slot cap', () => {
    const engine = fakeEngine();
    const sustainedRef = { current: false };
    mockUseCoordinator.mockReturnValue(coordinatorState(engine, sustainedRef));
    mockUsePlayWall.mockReturnValue(false);
    // Plus plan caps at 8 loop slots (see src/entitlements.ts).
    mockUseAuth.mockReturnValue(plusAuthState);
    render(<PlayShell />);

    fireEvent.click(armButton());
    expect(armButton().getAttribute('aria-pressed')).toBe('true');

    const addChordButton = screen.getByRole('button', { name: /\+ chord/i });
    for (let i = 0; i < 8; i++) {
      fireEvent.click(addChordButton);
    }

    expect(slotCount()).toBe(8);
    expect(armButton().getAttribute('aria-pressed')).toBe('false');
  });
});

describe('HUD clusters', () => {
  it('groups Record, Record video, and MP3 into a top-left capture capsule', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    render(<PlayShell />);
    const capsule = document.querySelector('.hud-capture');
    expect(capsule).not.toBeNull();
    // Record (real component, free tier shows lock badge — match loosely)
    expect(capsule!.contains(screen.getByRole('button', { name: /^record\b(?!.*video)/i }))).toBe(true);
    // Video (mocked as a testid div at the top of this file)
    expect(capsule!.contains(screen.getByTestId('video-record-button'))).toBe(true);
    // MP3
    expect(capsule!.contains(screen.getByRole('button', { name: /mp3/i }))).toBe(true);
  });

  it('groups Learn, Share, Feedback, and profile into a top-right nav capsule', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    render(<PlayShell />);
    const capsule = document.querySelector('.hud-nav');
    expect(capsule).not.toBeNull();
    expect(capsule!.contains(screen.getByRole('button', { name: /learn/i }))).toBe(true);
    expect(capsule!.contains(screen.getByRole('button', { name: /share/i }))).toBe(true);
    // FeedbackButton renders an <a>, so its role is link
    expect(capsule!.contains(screen.getByRole('link', { name: /feedback/i }))).toBe(true);
    // ProfileButton signed-out aria-label is "Sign in and settings"
    // (signed-in: "Account and settings") — match the shared suffix
    expect(capsule!.contains(screen.getByRole('button', { name: /and settings/i }))).toBe(true);
  });

  it('stacks the loop area directly above the music bar in one bottom container', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    render(<PlayShell />);
    const stack = document.querySelector('.hud-bottom-stack');
    expect(stack).not.toBeNull();
    const teaser = document.querySelector('.loop-teaser'); // free tier default mock
    const bar = document.querySelector('.hud-bottom');
    expect(stack!.contains(teaser!)).toBe(true);
    expect(stack!.contains(bar!)).toBe(true);
    // teaser renders above (before) the bar
    expect(teaser!.compareDocumentPosition(bar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the loop panel inside the bottom stack, above the music bar, for plus tier', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUseAuth.mockReturnValue(plusAuthState);
    render(<PlayShell />);
    const stack = document.querySelector('.hud-bottom-stack');
    expect(stack).not.toBeNull();
    const panel = document.querySelector('.loop-panel');
    expect(panel).not.toBeNull();
    expect(screen.getByRole('group', { name: /chord looper/i })).toBe(panel);
    const bar = document.querySelector('.hud-bottom');
    expect(stack!.contains(panel)).toBe(true);
    expect(stack!.contains(bar!)).toBe(true);
    // loop panel renders above (before) the music bar
    expect(panel!.compareDocumentPosition(bar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
