import type { PlanId } from './pricingTiers.ts';

// The plan a user's access is judged by. Beta testers get Studio-level
// access regardless of billing state; the flag lives in profiles.beta_tester
// and is writable only by the service role (see 0003_entitlements.sql), so
// it can't be self-granted from the browser.
export type EffectivePlan = 'free' | PlanId;

// Recordings are video-only (dials + the player's camera + mic) — the camera
// is always in frame by design; there is no dials-only capture on any plan.
// Quotas and length caps are mirrored server-side in 0005_video_recordings.sql.
export interface Entitlements {
  /** Piano sampler instrument (Plus+). Free is synth-only. */
  pianoUnlocked: boolean;
  /** Canvas accent themes (Plus+). Free plays in the default froola look. */
  visualThemesUnlocked: boolean;
  /** Stored recordings the plan may keep (1 / 3 / Infinity). Recording at
      the cap replaces the oldest on free; paid plans manage slots manually. */
  maxRecordings: number;
  /** Hard stop for the video recorder (20s / 3min / 5min). */
  maxVideoRecordMs: number;
  /** Free recordings get a big corner watermark burned in at record time. */
  recordingWatermark: boolean;
  /** MP3/MP4 export of a stored recording (Plus+). */
  exportUnlocked: boolean;
  /** Plus exports carry the watermark; Studio exports are clean. */
  exportWatermark: boolean;
  /** Studio: record the camera full-frame without the dials layer. The
      camera itself can never be hidden. */
  hideDialsUnlocked: boolean;
  /** Chord looper (Plus+). Free doesn't get the feature at all. */
  loopUnlocked: boolean;
  /** Chord-loop slots the UI lets the user fill (engine caps at MAX_SLOTS). */
  loopSlots: number;
  /** Arpeggiator (Plus+). Free doesn't get the feature at all. */
  arpUnlocked: boolean;
}

const BY_PLAN: Record<EffectivePlan, Entitlements> = {
  free: {
    pianoUnlocked: false,
    visualThemesUnlocked: false,
    maxRecordings: 1,
    maxVideoRecordMs: 20_000,
    recordingWatermark: true,
    exportUnlocked: false,
    exportWatermark: true,
    hideDialsUnlocked: false,
    loopUnlocked: false,
    loopSlots: 0,
    arpUnlocked: false,
  },
  plus: {
    pianoUnlocked: true,
    visualThemesUnlocked: true,
    maxRecordings: 3,
    maxVideoRecordMs: 180_000,
    recordingWatermark: false,
    exportUnlocked: true,
    exportWatermark: true,
    hideDialsUnlocked: false,
    loopUnlocked: true,
    loopSlots: 8,
    arpUnlocked: true,
  },
  studio: {
    pianoUnlocked: true,
    visualThemesUnlocked: true,
    maxRecordings: Infinity,
    maxVideoRecordMs: 300_000,
    recordingWatermark: false,
    exportUnlocked: true,
    exportWatermark: false,
    hideDialsUnlocked: true,
    loopUnlocked: true,
    loopSlots: Infinity,
    arpUnlocked: true,
  },
};

export function effectivePlan(
  profile: { plan: EffectivePlan; betaTester: boolean } | null,
): EffectivePlan {
  if (!profile) return 'free';
  return profile.betaTester ? 'studio' : profile.plan;
}

export function entitlementsFor(
  profile: { plan: EffectivePlan; betaTester: boolean } | null,
): Entitlements {
  return BY_PLAN[effectivePlan(profile)];
}
