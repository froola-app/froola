// A user-gesture audio unlock, decoupled from AudioEngine's lifetime: the
// landing CTA click creates + resumes a context synchronously inside the
// gesture (browsers count that as user activation), and AudioEngine's
// constructor adopts it on /play. Without this, camera-only players never
// perform the tap that browsers require before sound.
let unlocked: AudioContext | null = null;

/** Call synchronously inside a user gesture (click) handler. */
export function unlockAudio(): void {
  try {
    if (!unlocked) unlocked = new AudioContext();
    void unlocked.resume();
  } catch {
    unlocked = null; // autoplay-policy edge: fall back to the in-app unlock
  }
}

/** Adopt (and clear) the unlocked context, if any. */
export function takeUnlockedContext(): AudioContext | null {
  const ctx = unlocked;
  unlocked = null;
  return ctx;
}

/** Put a context back in the stash (used when a consumer tears down
 *  without ever using it — e.g. React StrictMode's dev-only double-invoke
 *  of effects). Never overwrites a newer click's stashed context. */
export function restashUnlockedContext(ctx: AudioContext): void {
  if (!unlocked) unlocked = ctx;
}
