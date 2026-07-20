import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlockAudio, takeUnlockedContext } from './unlockedContext';
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
});
