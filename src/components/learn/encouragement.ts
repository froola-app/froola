import { useEffect, useRef, useState } from 'react';

// How often the state machine samples the live score.
const TICK_MS = 100;

/** Warm, playful cheers shown live while a learner is playing well. */
export const ENCOURAGEMENTS = [
  'Nice! 🎵',
  "You've got this",
  'Look at you go!',
  'Smooth 👌',
  "That's it — keep going",
  "You're on fire 🔥",
  'Sounding great',
] as const;

/** Pick a random phrase that isn't `prev`. `rng` is injectable for tests. */
export function pickPhrase(prev: string | null, rng: () => number = Math.random): string {
  const pool = prev === null ? ENCOURAGEMENTS : ENCOURAGEMENTS.filter((p) => p !== prev);
  return pool[Math.floor(rng() * pool.length)] ?? ENCOURAGEMENTS[0];
}

// Score must reach this to start cheering, and hold this briefly first.
const ON_THRESHOLD = 75;
const HOLD_MS = 500;
// Cheer only stops once score drops below this — the gap to ON_THRESHOLD is the
// hysteresis band that stops it flickering on/off.
const OFF_THRESHOLD = 60;
// While cheering, swap in a fresh phrase this often so it doesn't go stale.
const ROTATE_MS = 4000;

/**
 * Live encouragement state machine driven by the running step score.
 * Returns the current cheer phrase, or null when not cheering.
 *
 * @param stepScore 0–100 live score
 * @param active    whether encouragement should run (e.g. attempt phase)
 */
export function useEncouragement(stepScore: number, active: boolean): string | null {
  const [phrase, setPhrase] = useState<string | null>(null);

  // Latest values read inside the polling loop without re-arming it.
  const scoreRef = useRef(stepScore);
  const phraseRef = useRef<string | null>(null);
  useEffect(() => { scoreRef.current = stepScore; }, [stepScore]);
  useEffect(() => { phraseRef.current = phrase; }, [phrase]);

  useEffect(() => {
    if (!active) return;

    let elapsed = 0;
    let onSince: number | null = null; // when score first reached ON_THRESHOLD
    let lastRotate = 0;

    const id = setInterval(() => {
      elapsed += TICK_MS;
      const score = scoreRef.current;

      if (phraseRef.current !== null) {
        // Cheering: stop only once we fall out of the hysteresis band, else
        // rotate to a fresh phrase periodically.
        if (score < OFF_THRESHOLD) {
          setPhrase(null);
          onSince = null;
        } else if (elapsed - lastRotate >= ROTATE_MS) {
          lastRotate = elapsed;
          setPhrase((prev) => pickPhrase(prev));
        }
        return;
      }

      // Not cheering: require the score to hold at/above ON_THRESHOLD so brief
      // spikes don't trigger it.
      if (score >= ON_THRESHOLD) {
        if (onSince === null) onSince = elapsed;
        else if (elapsed - onSince >= HOLD_MS) {
          setPhrase(pickPhrase(null));
          lastRotate = elapsed;
          onSince = null;
        }
      } else {
        onSince = null;
      }
    }, TICK_MS);

    return () => {
      clearInterval(id);
      setPhrase(null);
    };
  }, [active]);

  return phrase;
}
