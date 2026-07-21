import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlockAudio, takeUnlockedContext, restashUnlockedContext } from './unlockedContext';
import { AudioEngine } from './AudioEngine';

beforeEach(() => {
  vi.clearAllMocks();
  takeUnlockedContext(); // drain any stash left by a previous test
});

describe('unlockedContext', () => {
  it('stashes a resumed context and take clears it', () => {
    unlockAudio();
    const ctx = takeUnlockedContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.resume).toHaveBeenCalled();
    expect(takeUnlockedContext()).toBeNull();
  });

  it('unlockAudio is idempotent — one context across repeat calls', () => {
    unlockAudio();
    unlockAudio();
    const ctx = takeUnlockedContext();
    expect(ctx).not.toBeNull();
    expect(takeUnlockedContext()).toBeNull();
  });

  it('AudioEngine consumes the stashed context', () => {
    unlockAudio();
    new AudioEngine();
    // engine took it — stash is empty now
    expect(takeUnlockedContext()).toBeNull();
  });

  it('AudioEngine constructs its own context when nothing is stashed', () => {
    expect(takeUnlockedContext()).toBeNull();
    const engine = new AudioEngine();
    expect(engine.audioState()).toBeDefined(); // engine has a working ctx
  });

  it('restashUnlockedContext puts a context back so a later take returns it', () => {
    unlockAudio();
    const ctx = takeUnlockedContext();
    expect(ctx).not.toBeNull();
    restashUnlockedContext(ctx!);
    expect(takeUnlockedContext()).toBe(ctx);
    expect(takeUnlockedContext()).toBeNull();
  });

  it('restashUnlockedContext does not overwrite an already-stashed (newer) context', () => {
    // webAudioMock's AudioContext is a singleton (same object every
    // construction), so distinguishing "stale" vs "newer" context by
    // identity requires two distinct fake objects here rather than
    // relying on unlockAudio()'s real construction path.
    const stale = { resume: vi.fn() } as unknown as AudioContext;
    const newer = { resume: vi.fn() } as unknown as AudioContext;
    restashUnlockedContext(newer); // simulate a newer click's stash
    restashUnlockedContext(stale); // should be ignored — newer wins
    expect(takeUnlockedContext()).toBe(newer);
    expect(takeUnlockedContext()).toBeNull();
  });
});
