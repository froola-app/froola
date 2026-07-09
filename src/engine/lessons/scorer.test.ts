import { scoreFrame, accuracy, combinedScore } from './scorer';

describe('scoreFrame', () => {
  it('hits both note and quality on an exact match', () => {
    expect(scoreFrame(0, 0, 0, 0)).toEqual({ noteHit: true, qualHit: true });
  });

  it('hits only note when quality differs', () => {
    expect(scoreFrame(0, 2, 0, 5)).toEqual({ noteHit: true, qualHit: false });
  });

  it('hits only quality when note differs', () => {
    expect(scoreFrame(0, 2, 4, 2)).toEqual({ noteHit: false, qualHit: true });
  });

  it('misses both when neither matches', () => {
    expect(scoreFrame(0, 0, 4, 5)).toEqual({ noteHit: false, qualHit: false });
  });
});

describe('accuracy', () => {
  it('returns 0 for an empty frame list', () => {
    expect(accuracy([])).toBe(0);
  });

  it('returns 100 when every frame hits', () => {
    expect(accuracy([true, true, true])).toBe(100);
  });

  it('returns 0 when every frame misses', () => {
    expect(accuracy([false, false])).toBe(0);
  });

  it('rounds partial accuracy', () => {
    expect(accuracy([true, false, true])).toBe(67); // 2/3 -> 66.67 -> 67
  });
});

describe('combinedScore', () => {
  it('matches the old 50/50 weighting', () => {
    expect(combinedScore(100, 0)).toBe(50);
    expect(combinedScore(0, 100)).toBe(50);
    expect(combinedScore(100, 100)).toBe(100);
    expect(combinedScore(0, 0)).toBe(0);
  });

  it('rounds the average', () => {
    expect(combinedScore(67, 100)).toBe(84); // 83.5 -> 84
  });
});

import { chordSpans, scoreChords, type LiveFrame } from './scorer';
import type { Recording } from '../types';

function rec(...chunks: Array<[noteIdx: number, qualIdx: number, ms: number]>): Recording {
  const samples = chunks.flatMap(([n, q, ms]) =>
    Array.from({ length: ms / 100 }, () => ({ dt: 100, noteIdx: n, qualityIdx: q, vibe: 0 })),
  );
  return { samples, totalMs: samples.length * 100 };
}

describe('chordSpans', () => {
  it('collapses consecutive same-chord samples into spans', () => {
    expect(chordSpans(rec([0, 0, 300], [3, 0, 200], [0, 0, 100]))).toEqual([
      { noteIdx: 0, qualIdx: 0, startMs: 0, endMs: 300 },
      { noteIdx: 3, qualIdx: 0, startMs: 300, endMs: 500 },
      { noteIdx: 0, qualIdx: 0, startMs: 500, endMs: 600 },
    ]);
  });

  it('returns an empty list for an empty recording', () => {
    expect(chordSpans({ samples: [], totalMs: 0 })).toEqual([]);
  });
});

describe('scoreChords', () => {
  const spans = chordSpans(rec([0, 0, 2000], [3, 0, 2000])); // C (0–2000), F (2000–4000)
  const frame = (tMs: number, n: number, q: number): LiveFrame => ({ tMs, noteIdx: n, qualIdx: q });

  it('scores 100 when every chord is matched somewhere in its window', () => {
    const frames = [frame(500, 0, 0), frame(2500, 3, 0)];
    expect(scoreChords(spans, frames, false)).toEqual({ score: 100, noteAccuracy: 100, qualAccuracy: 100 });
  });

  it('still hits a chord matched only inside the grace window after its end', () => {
    // F only matched at 4300ms — within min(500, 1000) grace past endMs 4000.
    const frames = [frame(500, 0, 0), frame(4300, 3, 0)];
    expect(scoreChords(spans, frames, false).score).toBe(100);
  });

  it('misses a chord matched only outside the grace window', () => {
    // F matched at 4600ms — past the 500ms grace.
    const frames = [frame(500, 0, 0), frame(4600, 3, 0)];
    expect(scoreChords(spans, frames, false).score).toBe(50);
  });

  it('caps grace at half the span length', () => {
    const short = chordSpans(rec([0, 0, 400], [3, 0, 400])); // grace = 200ms
    // C matched at 650ms: span ends 400, grace 200 → window ends 600. Miss.
    expect(scoreChords(short, [frame(650, 0, 0)], false).score).toBe(0);
  });

  it('separates note and quality accuracy', () => {
    // Right notes, wrong quality on both chords.
    const frames = [frame(500, 0, 3), frame(2500, 3, 3)];
    const s = scoreChords(spans, frames, false);
    expect(s.noteAccuracy).toBe(100);
    expect(s.qualAccuracy).toBe(0);
    expect(s.score).toBe(0);
  });

  it('ignores quality when noteOnly is set (fist-solo)', () => {
    const frames = [frame(500, 0, 3), frame(2500, 3, 3)];
    expect(scoreChords(spans, frames, true)).toEqual({ score: 100, noteAccuracy: 100, qualAccuracy: 100 });
  });

  it('returns zeros for an empty span list', () => {
    expect(scoreChords([], [], false)).toEqual({ score: 0, noteAccuracy: 0, qualAccuracy: 0 });
  });
});
