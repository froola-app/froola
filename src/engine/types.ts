export type GestureSignal = {
  x: number;        // 0–1, horizontal position (left = 0, right = 1)
  y: number;        // 0–1, vertical position (top = 0, bottom = 1)
  present: boolean; // is a hand/cursor actively tracked?
  handId: 'primary' | 'secondary';
};

export type MusicalCommand = {
  chord: string;      // e.g. "Cmaj7"
  voicing: number[];  // MIDI note numbers
  register: number;   // 0–1, high to low
  texture: number;    // 0–1, sparse to dense
  tension: number;    // 0–1, tonal to dissonant (drives warm-zone color)
};
