// Frame-by-frame scoring: 50 pts for note match + 50 pts for quality match.
// Rewards sustaining the correct chord, not just touching it.
export function scoreFrame(
  targetNoteIdx: number,
  targetQualIdx: number,
  liveNoteIdx: number,
  liveQualIdx: number,
): number {
  return (targetNoteIdx === liveNoteIdx ? 50 : 0) +
         (targetQualIdx === liveQualIdx ? 50 : 0);
}

export function meanScore(frames: number[]): number {
  if (frames.length === 0) return 0;
  return Math.round(frames.reduce((s, v) => s + v, 0) / frames.length);
}
