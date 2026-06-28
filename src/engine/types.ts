export type InstrumentMode = 'synth' | 'piano' | 'guitar' | 'pad';

export type GestureSignal = {
  x: number;        // 0–1, horizontal position (left = 0, right = 1)
  y: number;        // 0–1, vertical position (top = 0, bottom = 1)
  present: boolean; // is a hand/cursor actively tracked?
  handId: 'left' | 'right';
};

export type NoteName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type ChordQuality = 'major' | 'minor' | 'maj7' | 'min7' | 'dom7' | 'aug' | 'dim';

export const NOTES: NoteName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

export type MusicalCommand = {
  chord: string;      // e.g. "Cmaj7"
  voicing: number[];  // MIDI note numbers
  register: number;   // 0–1, high to low
  texture: number;    // 0–1, sparse to dense
  tension: number;    // 0–1, tonal to dissonant (drives warm-zone color)
  rootNote: NoteName;
  chordQuality: ChordQuality;
};

/** One recorded gesture sample. 5 bytes when packed by codec. */
export type RecordingSample = {
  dt: number;         // ms since previous sample (uint16)
  noteIdx: number;    // 0–6, index into NOTES array
  qualityIdx: number; // 0–6, index into QUALITIES array
  vibe: number;       // 0–3, index into VIBES array
};

export type Recording = {
  samples: RecordingSample[];
  totalMs: number;    // sum of all dt values
};
