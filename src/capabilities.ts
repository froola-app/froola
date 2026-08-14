// Froola is open source and every capability is on for everyone. This module
// used to resolve a Stripe plan into a feature matrix; it now describes what
// the app can do, full stop, and the shape is kept so the dormant billing
// reference implementation under `optional/billing/` still type-checks against
// something real. Nothing in the app path reads a plan.

// A single technical ceiling for video capture, chosen for browser memory
// rather than for a price tier: MediaRecorder buffers in RAM until the blob is
// written, and ten minutes of 720p is already a few hundred megabytes.
export const MAX_VIDEO_RECORD_MS = 600_000;

export interface Capabilities {
  /** Piano sampler instrument. */
  pianoUnlocked: boolean;
  /** Canvas accent themes for the wheels and hand markers. */
  visualThemesUnlocked: boolean;
  /** Stored recordings kept locally. Unbounded; the browser is the limit. */
  maxRecordings: number;
  /** Hard stop for the video recorder, see MAX_VIDEO_RECORD_MS. */
  maxVideoRecordMs: number;
  /** No recording is ever watermarked. */
  recordingWatermark: boolean;
  /** MP3/MP4 export of a stored recording. */
  exportUnlocked: boolean;
  /** No export is ever watermarked. */
  exportWatermark: boolean;
  /** Record the camera full-frame without the dials layer. The camera itself
      can never be hidden: recordings are video-only by design. */
  hideDialsUnlocked: boolean;
  /** Chord looper. */
  loopUnlocked: boolean;
  /** Chord-loop slots the UI lets the user fill (engine caps at MAX_SLOTS). */
  loopSlots: number;
  /** Arpeggiator. */
  arpUnlocked: boolean;
}

export const FULL_ACCESS: Capabilities = {
  pianoUnlocked: true,
  visualThemesUnlocked: true,
  maxRecordings: Infinity,
  maxVideoRecordMs: MAX_VIDEO_RECORD_MS,
  recordingWatermark: false,
  exportUnlocked: true,
  exportWatermark: false,
  hideDialsUnlocked: true,
  loopUnlocked: true,
  loopSlots: Infinity,
  arpUnlocked: true,
};

/** Everyone gets everything, signed in or not. */
export function capabilities(): Capabilities {
  return FULL_ACCESS;
}
