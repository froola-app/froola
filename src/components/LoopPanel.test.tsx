import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoopPanel from './LoopPanel';
import type { ChordLooper, LooperState, SavedLoop } from '../engine/looper';

function looperStub(overrides: Partial<ChordLooper> = {}): ChordLooper {
  return {
    undo: vi.fn(),
    clear: vi.fn(),
    setBpm: vi.fn(),
    setBeatsPerSlot: vi.fn(),
    toggle: vi.fn(),
    getSlots: vi.fn().mockReturnValue([]),
    load: vi.fn(),
    ...overrides,
  } as unknown as ChordLooper;
}

const EMPTY_STATE: LooperState = {
  slots: [], playing: false, bpm: 90, beatsPerSlot: 4, currentSlot: -1,
};

const FILLED_STATE: LooperState = {
  slots: ['C', 'G'], playing: false, bpm: 90, beatsPerSlot: 4, currentSlot: -1,
};

const SAVED: SavedLoop[] = [
  { name: 'My Loop', bpm: 100, beatsPerSlot: 4, slots: [], savedAt: 1 },
  { name: 'Another', bpm: 80, beatsPerSlot: 2, slots: [], savedAt: 2 },
];

function baseProps() {
  return {
    looper: looperStub(),
    state: EMPTY_STATE,
    onAddChord: vi.fn(),
    armed: false,
    onToggleArm: vi.fn(),
    savedLoops: [] as SavedLoop[],
    onSaveLoop: vi.fn(),
    onLoadLoop: vi.fn(),
    onDeleteLoop: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoopPanel', () => {
  it('renders the arm toggle first with aria-pressed reflecting armed state', () => {
    const props = baseProps();
    render(<LoopPanel {...props} />);
    const armBtn = screen.getByRole('button', { name: /arm/i });
    expect(armBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows armed state and aria-pressed=true when armed', () => {
    const props = baseProps();
    render(<LoopPanel {...props} armed />);
    const armBtn = screen.getByRole('button', { name: /armed/i });
    expect(armBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleArm when the arm button is clicked', () => {
    const props = baseProps();
    render(<LoopPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /arm/i }));
    expect(props.onToggleArm).toHaveBeenCalledTimes(1);
  });

  it('prompts for a name and calls onSaveLoop when "Save loop…" is clicked', () => {
    const props = { ...baseProps(), state: FILLED_STATE };
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Verse 1');
    render(<LoopPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /save loop/i }));

    expect(promptSpy).toHaveBeenCalledWith('Name this loop');
    expect(props.onSaveLoop).toHaveBeenCalledWith('Verse 1');
    promptSpy.mockRestore();
  });

  it('skips onSaveLoop when the prompt is cancelled or empty', () => {
    const props = { ...baseProps(), state: FILLED_STATE };
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<LoopPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /save loop/i }));

    expect(props.onSaveLoop).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('renders a row per saved loop with Load and Delete buttons', () => {
    const props = baseProps();
    render(<LoopPanel {...props} savedLoops={SAVED} />);

    expect(screen.getByText('My Loop')).toBeDefined();
    expect(screen.getByText('Another')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^load$/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(2);
  });

  it('calls onLoadLoop with the loop when a row\'s Load button is clicked', () => {
    const props = baseProps();
    render(<LoopPanel {...props} savedLoops={SAVED} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^load$/i })[1]);

    expect(props.onLoadLoop).toHaveBeenCalledWith(SAVED[1]);
  });

  it('calls onDeleteLoop with the loop name when a row\'s Delete button is clicked', () => {
    const props = baseProps();
    render(<LoopPanel {...props} savedLoops={SAVED} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);

    expect(props.onDeleteLoop).toHaveBeenCalledWith('My Loop');
  });

  it('sets a title on the saved-loop name so a truncated name is still readable on hover', () => {
    const props = baseProps();
    render(<LoopPanel {...props} savedLoops={SAVED} />);

    expect(screen.getByText('My Loop')).toHaveAttribute('title', 'My Loop');
  });
});
