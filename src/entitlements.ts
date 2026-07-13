import type { PlanId } from './pricingTiers.ts';

// The plan a user's access is judged by. Beta testers get Studio-level
// access regardless of billing state; the flag lives in profiles.beta_tester
// and is writable only by the service role (see 0003_entitlements.sql), so
// it can't be self-granted from the browser.
export type EffectivePlan = 'free' | PlanId;

export interface Entitlements {
  /** Piano sampler instrument (Plus+). Free is synth-only. */
  pianoUnlocked: boolean;
  /** Video recording + download (Plus+). Free sees a locked teaser. */
  videoRecordUnlocked: boolean;
  /** Shareable replay recording (Plus+). Free sees a locked teaser. */
  replayRecordUnlocked: boolean;
  /** Canvas accent themes (Plus+). Free plays in the default froola look. */
  visualThemesUnlocked: boolean;
  /** WAV/MP3 session audio download + loop MIDI export (Studio). */
  audioDownloadUnlocked: boolean;
  /** Always-on rolling replay buffer — "save the last 30s" (Studio). */
  instantReplayUnlocked: boolean;
  /** Free recordings carry a "made with froola" watermark — on replay
   *  playback and burned into downloaded videos. */
  replayWatermark: boolean;
  /** Hard stop for the shareable-replay recorder. Recording length and
   *  replay length are one product concept: this always equals
   *  maxVideoRecordMs (20s free / 3 min plus / 5 min studio). */
  maxReplayRecordMs: number;
  /** Hard stop for the video recorder (3 min Plus, 5 min Studio). */
  maxVideoRecordMs: number;
  /** Chord looper (Plus+). Free doesn't get the feature at all. */
  loopUnlocked: boolean;
  /** Chord-loop slots the UI lets the user fill (engine caps at MAX_SLOTS). */
  loopSlots: number;
  /** Arpeggiator (Plus+). Free doesn't get the feature at all. */
  arpUnlocked: boolean;
  /** Custom chord wheels — user-defined root+quality per slice (Plus+). */
  customWheelsUnlocked: boolean;
  /** How many saved replay recordings the account may hold (1 / 3 / ∞).
   *  Saving at the cap replaces the oldest — its share link dies. */
  maxSavedRecordings: number;
  /** MP3 session export (Plus+). */
  audioExportUnlocked: boolean;
  /** Downloaded MP4s carry the burned-in watermark (free + plus; Studio
   *  exports clean). Distinct from replayWatermark, which is playback-only. */
  exportWatermark: boolean;
  /** Paste-in lyrics + chords song sheet (Plus+). */
  lyricsImportUnlocked: boolean;
  /** One persistent saved song: sheet + stored loops (Plus+). */
  mySongUnlocked: boolean;
}

const BY_PLAN: Record<EffectivePlan, Entitlements> = {
  free: {
    pianoUnlocked: false,
    videoRecordUnlocked: false,
    replayRecordUnlocked: true,
    visualThemesUnlocked: false,
    audioDownloadUnlocked: false,
    instantReplayUnlocked: false,
    replayWatermark: true,
    maxReplayRecordMs: 20_000,
    maxVideoRecordMs: 20_000,
    loopUnlocked: false,
    loopSlots: 0,
    arpUnlocked: false,
    customWheelsUnlocked: false,
    maxSavedRecordings: 1,
    audioExportUnlocked: false,
    exportWatermark: true,
    lyricsImportUnlocked: false,
    mySongUnlocked: false,
  },
  plus: {
    pianoUnlocked: true,
    videoRecordUnlocked: true,
    replayRecordUnlocked: true,
    visualThemesUnlocked: true,
    audioDownloadUnlocked: false,
    instantReplayUnlocked: false,
    replayWatermark: false,
    maxReplayRecordMs: 180_000,
    maxVideoRecordMs: 180_000,
    loopUnlocked: true,
    loopSlots: 8,
    arpUnlocked: true,
    customWheelsUnlocked: true,
    maxSavedRecordings: 3,
    audioExportUnlocked: true,
    exportWatermark: true,
    lyricsImportUnlocked: true,
    mySongUnlocked: true,
  },
  studio: {
    pianoUnlocked: true,
    videoRecordUnlocked: true,
    replayRecordUnlocked: true,
    visualThemesUnlocked: true,
    audioDownloadUnlocked: true,
    instantReplayUnlocked: true,
    replayWatermark: false,
    maxReplayRecordMs: 300_000,
    maxVideoRecordMs: 300_000,
    loopUnlocked: true,
    loopSlots: Infinity,
    arpUnlocked: true,
    customWheelsUnlocked: true,
    maxSavedRecordings: Infinity,
    audioExportUnlocked: true,
    exportWatermark: false,
    lyricsImportUnlocked: true,
    mySongUnlocked: true,
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
