import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayShell from './PlayShell';
import { useCoordinator } from '../coordinator';
import { useAuth } from '../contexts/AuthContext';
import { listWheels } from '../engine/music/customWheelStore';

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../coordinator', () => ({ useCoordinator: vi.fn() }));
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

describe('PlayShell — octave keydown guard', () => {
  it('ignores ArrowUp/ArrowDown while a text field is focused (e.g. the My Song textarea)', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
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
    render(<PlayShell />);

    fireEvent.keyDown(document.body, { key: 'ArrowUp' });

    expect(screen.getByText('oct +1')).toBeInTheDocument();
  });
});

describe('PlayShell — custom wheel selector gating', () => {
  it('selecting "New wheel…" opens the WheelEditor dialog', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
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

  it('loads saved wheels on mount', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
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

});

describe('PlayShell — mobile is a bare canvas', () => {
  const realMatchMedia = window.matchMedia;
  const realWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    localStorage.removeItem('froola.tutorialSeen');
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    Object.defineProperty(window, 'innerWidth', { value: realWidth, configurable: true });
  });

  it('renders the profile button and nothing else — no other buttons, links, or selects', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    render(<PlayShell />);

    // Signed-out aria-label is "Sign in and settings" (signed-in: "Account
    // and settings") — match the shared suffix.
    const profile = screen.getByRole('button', { name: /and settings/i });
    expect(screen.queryAllByRole('button')).toEqual([profile]);
    expect(document.querySelector('.hud-nav')!.contains(profile)).toBe(true);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(document.querySelector('.hud-capture')).toBeNull();
    expect(document.querySelector('.hud-bottom-stack')).toBeNull();
  });

  it('does not render the beginner tutorial', () => {
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    render(<PlayShell />);

    expect(document.querySelector('.tutorial-overlay')).toBeNull();
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

  it('renders the recording progress bar as a capsule sibling, not a segment', () => {
    // During a take, RecordButton mounts .record-progress as a direct child
    // of .hud-capture (a fragment sibling of the button). The capsule CSS
    // keys end-caps/dividers to classes so this extra child must never pick
    // up segment styling — this test pins the structure that hazard lives in.
    const engine = fakeEngine();
    mockUseCoordinator.mockReturnValue(coordinatorState(engine));
    mockUseAuth.mockReturnValue(plusAuthState); // plus: replay recording unlocked
    render(<PlayShell />);
    fireEvent.click(screen.getByRole('button', { name: /^record\b(?!.*video)/i }));
    const capsule = document.querySelector('.hud-capture')!;
    expect(capsule.querySelector(':scope > .record-progress')).not.toBeNull();
    expect(capsule.contains(screen.getByRole('button', { name: /stop/i }))).toBe(true);
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

  it('renders the loop panel inside the bottom stack, above the music bar', () => {
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
