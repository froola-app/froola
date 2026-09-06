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

import type { Recording } from '../types';

// A run of consecutive identical chords in a target recording.
export type ChordSpan = { noteIdx: number; qualIdx: number; startMs: number; endMs: number };

export function chordSpans(recording: Recording): ChordSpan[] {
  const spans: ChordSpan[] = [];
  let t = 0;
  for (const s of recording.samples) {
    const last = spans[spans.length - 1];
    if (last && last.noteIdx === s.noteIdx && last.qualIdx === s.qualityIdx) {
      last.endMs = t + s.dt;
    } else {
      spans.push({ noteIdx: s.noteIdx, qualIdx: s.qualityIdx, startMs: t, endMs: t + s.dt });
    }
    t += s.dt;
  }
  return spans;
}

export type LiveFrame = { tMs: number; noteIdx: number; qualIdx: number };
export type ChordScore = { score: number; noteAccuracy: number; qualAccuracy: number };

const MAX_GRACE_MS = 500;

// Each chord counts once: hit if the live selection matched it at any logged
// frame inside [startMs − grace, endMs + grace]. Late transitions never cost
// the chord — playing every chord in order is a genuine 100.
export function scoreChords(spans: ChordSpan[], frames: LiveFrame[], noteOnly: boolean): ChordScore {
  if (spans.length === 0) return { score: 0, noteAccuracy: 0, qualAccuracy: 0 };
  let noteHits = 0, qualHits = 0, fullHits = 0;
  for (const span of spans) {
    const grace = Math.min(MAX_GRACE_MS, (span.endMs - span.startMs) / 2);
    const inWindow = frames.filter(f => f.tMs >= span.startMs - grace && f.tMs <= span.endMs + grace);
    const noteHit = inWindow.some(f => f.noteIdx === span.noteIdx);
    const qualHit = inWindow.some(f => f.qualIdx === span.qualIdx);
    // Note and quality don't need to land on the same logged frame — a player
    // correcting one wheel then the other should still get credit as long as
    // both were right at some point in the window.
    const fullHit = noteOnly ? noteHit : (noteHit && qualHit);
    if (noteHit) noteHits++;
    if (noteOnly ? noteHit : qualHit) qualHits++;
    if (fullHit) fullHits++;
  }
  const pct = (n: number) => Math.round((n / spans.length) * 100);
  return { score: pct(fullHits), noteAccuracy: pct(noteHits), qualAccuracy: pct(qualHits) };
}
