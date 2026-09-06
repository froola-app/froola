// Froola is open source and every capability is on for everyone. This module
// used to resolve a Stripe plan into a feature matrix; it now describes what
// the app can do, full stop. Nothing here reads a plan, a profile, or a
// subscription, and nothing should reintroduce one.
//
// The shape is deliberately wide: it keeps every flag the app reads so call
// sites stay unchanged, and so the dormant billing reference implementation
// under `optional/billing/` still type-checks against something real. Every
// flag is a constant. If you find yourself wanting to compute one, that is the
// paywall growing back.

// A single technical ceiling for video capture, chosen for browser memory
// rather than for a price tier: MediaRecorder buffers in RAM until the blob is
// written, and ten minutes of 720p is already a few hundred megabytes.
export const MAX_VIDEO_RECORD_MS = 600_000;

// The gesture recorder stores a few bytes per sample, so its ceiling is about
// keeping share links inside a URL rather than about memory.
export const MAX_REPLAY_RECORD_MS = 300_000;

export interface Capabilities {
  /** Piano sampler instrument. */
  pianoUnlocked: boolean;
  /** Video recording and download. */
  videoRecordUnlocked: boolean;
  /** Shareable gesture-replay recording. */
  replayRecordUnlocked: boolean;
  /** Canvas accent themes for the wheels and hand markers. */
  visualThemesUnlocked: boolean;
  /** WAV/MP3 session audio download and loop MIDI export. */
  audioDownloadUnlocked: boolean;
  /** Always-on rolling replay buffer, "save the last 30s". */
  instantReplayUnlocked: boolean;
  /** No replay is ever watermarked. */
  replayWatermark: boolean;
  /** Hard stop for the gesture recorder, see MAX_REPLAY_RECORD_MS. */
  maxReplayRecordMs: number;
  /** Hard stop for the video recorder, see MAX_VIDEO_RECORD_MS. */
  maxVideoRecordMs: number;
  /** Chord looper. */
  loopUnlocked: boolean;
  /** Chord-loop slots the UI lets the user fill (engine caps at MAX_SLOTS). */
  loopSlots: number;
  /** Arpeggiator. */
  arpUnlocked: boolean;
  /** Custom chord wheels, user-defined root and quality per slice. */
  customWheelsUnlocked: boolean;
  /** Stored recordings. Unbounded; the browser is the limit. */
  maxSavedRecordings: number;
  /** MP3 session export. */
  audioExportUnlocked: boolean;
  /** No export is ever watermarked. */
  exportWatermark: boolean;
  /** Paste-in lyrics and chords song sheet. */
  lyricsImportUnlocked: boolean;
  /** Persistent saved song: sheet plus stored loops. */
  mySongUnlocked: boolean;
  /** Record the camera full-frame without the dials layer. */
  hideDialsUnlocked: boolean;
}

export const FULL_ACCESS: Capabilities = {
  pianoUnlocked: true,
  videoRecordUnlocked: true,
  replayRecordUnlocked: true,
  visualThemesUnlocked: true,
  audioDownloadUnlocked: true,
  instantReplayUnlocked: true,
  replayWatermark: false,
  maxReplayRecordMs: MAX_REPLAY_RECORD_MS,
  maxVideoRecordMs: MAX_VIDEO_RECORD_MS,
  loopUnlocked: true,
  loopSlots: Infinity,
  arpUnlocked: true,
  customWheelsUnlocked: true,
  maxSavedRecordings: Infinity,
  audioExportUnlocked: true,
  exportWatermark: false,
  lyricsImportUnlocked: true,
  mySongUnlocked: true,
  hideDialsUnlocked: true,
};

/** Everyone gets everything, signed in or not. */
export function capabilities(): Capabilities {
  return FULL_ACCESS;
}
