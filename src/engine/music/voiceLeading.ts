// Automatic voice-leading: given a chord in root position, pick the inversion
// (upward or downward octave rotation) that moves least from the previous
// chord's voicing, so progressions connect smoothly instead of jumping in
// parallel root positions. Pure — the caller (coordinator) supplies the
// previous voicing.

// A candidate is rejected if its bass strays more than an octave from the
// root-position bass, so the register stays anchored to the octave the
// player chose rather than drifting to chase old chords.
const BASS_DRIFT_LIMIT = 12

/** Total motion: each candidate note's distance to its nearest previous note. */
function motion(candidate: number[], prev: number[]): number {
  return candidate.reduce(
    (sum, n) => sum + Math.min(...prev.map(p => Math.abs(n - p))), 0)
}

export function applyVoiceLeading(midis: number[], prevMidis: number[] | null): number[] {
  if (!prevMidis || prevMidis.length === 0 || midis.length < 2) return midis

  const root = [...midis].sort((a, b) => a - b)
  const rootBass = root[0]

  // Root position first so ties resolve toward it; then each inversion in
  // both directions (lowest k notes up an octave / highest k notes down).
  const candidates: number[][] = [root]
  for (let k = 1; k < root.length; k++) {
    candidates.push(
      [...root.slice(k), ...root.slice(0, k).map(n => n + 12)].sort((a, b) => a - b),
      [...root.slice(0, root.length - k), ...root.slice(root.length - k).map(n => n - 12)].sort((a, b) => a - b),
    )
  }

  let best = root
  let bestScore = motion(root, prevMidis)
  for (const cand of candidates.slice(1)) {
    if (Math.abs(cand[0] - rootBass) > BASS_DRIFT_LIMIT) continue
    const score = motion(cand, prevMidis)
    if (score < bestScore) {
      best = cand
      bestScore = score
    }
  }
  return best
}
