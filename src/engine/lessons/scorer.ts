// Frame-by-frame scoring: separate note-match and quality-match hits, so
// accuracy can be reported (and reasoned about) independently for each.
export type FrameHit = { noteHit: boolean; qualHit: boolean };

export function scoreFrame(
  targetNoteIdx: number,
  targetQualIdx: number,
  liveNoteIdx: number,
  liveQualIdx: number,
): FrameHit {
  return {
    noteHit: targetNoteIdx === liveNoteIdx,
    qualHit: targetQualIdx === liveQualIdx,
  };
}

export function accuracy(hits: boolean[]): number {
  if (hits.length === 0) return 0;
  return Math.round((hits.filter(Boolean).length / hits.length) * 100);
}

export function combinedScore(noteAccuracy: number, qualAccuracy: number): number {
  return Math.round((noteAccuracy + qualAccuracy) / 2);
}
