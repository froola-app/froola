export type InstrumentMode = 'synth' | 'piano';

export type GestureSignal = {
  x: number;        // 0–1, horizontal position (left = 0, right = 1)
  y: number;        // 0–1, vertical position (top = 0, bottom = 1)
  present: boolean; // is a hand/cursor actively tracked?
  handId: 'left' | 'right';
  fist?: boolean;   // true while hand is making a fist (chord lock)
  // Camera mode only: is the palm oriented toward the camera, and if not, how
  // is it off — rotated sideways ('turned') or fingers toward camera ('pitched')?
  facing?: 'ok' | 'turned' | 'pitched';
  // Ghost (lesson target) signals only — the wheel slice this orb sits on, so
  // the renderer can highlight that slice's own label instead of drawing a
  // second disconnected label next to the orb.
  sliceIdx?: number;
};

export type NoteName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type ChordQuality = 'major' | 'minor' | 'maj7' | 'min7' | 'dom7' | 'aug' | 'dim';

// Wheel starts at C (top slice) and ascends clockwise through the C-major scale.
export const NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

export type MusicalCommand = {
  chord: string;      // e.g. "Cmaj7"
  voicing: number[];  // MIDI note numbers
  register: number;   // 0–1, high to low
  texture: number;    // 0–1, sparse to dense
  tension: number;    // 0–1, tonal to dissonant (drives warm-zone color)
  rootNote: string;   // pitch-class label, e.g. "C" or "F#" (depends on key/scale)
  chordQuality: string; // diatonic quality is implied by scale; this holds the extension id
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
  /** Playback shows a "made with froola" overlay. Set on free-plan
      recordings; legacy (pre-flag) links are treated as watermarked. */
  watermark?: boolean;
};
