import type { PlanId } from './pricingTiers.ts';

// The plan a user's access is judged by. Beta testers get Studio-level
// access regardless of billing state; the flag lives in profiles.beta_tester
// and is writable only by the service role (see 0003_entitlements.sql), so
// it can't be self-granted from the browser.
export type EffectivePlan = 'free' | PlanId;

export interface Entitlements {
  /** Piano sampler instrument (Plus+). Free is synth-only. */
  pianoUnlocked: boolean;
  /** Video recording + download (Plus+). Free can only preview the button. */
  videoRecordUnlocked: boolean;
  /** Canvas accent themes (Plus+). Free plays in the default froola look. */
  visualThemesUnlocked: boolean;
  /** WAV/MP3 session audio download + loop MIDI export (Studio). */
  audioDownloadUnlocked: boolean;
  /** Always-on rolling replay buffer — "save the last 30s" (Studio). */
  instantReplayUnlocked: boolean;
  /** Free replays carry a "made with froola" watermark on playback. */
  replayWatermark: boolean;
  /** Hard stop for the shareable-replay recorder. */
  maxReplayRecordMs: number;
  /** Hard stop for the video recorder. Infinity on Studio. */
  maxVideoRecordMs: number;
  /** Chord-loop slots the UI lets the user fill (engine caps at MAX_SLOTS). */
  loopSlots: number;
}

const BY_PLAN: Record<EffectivePlan, Entitlements> = {
  free: {
    pianoUnlocked: false,
    videoRecordUnlocked: false,
    visualThemesUnlocked: false,
    audioDownloadUnlocked: false,
    instantReplayUnlocked: false,
    replayWatermark: true,
    maxReplayRecordMs: 20_000,
    maxVideoRecordMs: 0,
    loopSlots: 4,
  },
  plus: {
    pianoUnlocked: true,
    videoRecordUnlocked: true,
    visualThemesUnlocked: true,
    audioDownloadUnlocked: false,
    instantReplayUnlocked: false,
    replayWatermark: false,
    maxReplayRecordMs: 30_000,
    maxVideoRecordMs: 180_000,
    loopSlots: 8,
  },
  studio: {
    pianoUnlocked: true,
    videoRecordUnlocked: true,
    visualThemesUnlocked: true,
    audioDownloadUnlocked: true,
    instantReplayUnlocked: true,
    replayWatermark: false,
    maxReplayRecordMs: 30_000,
    maxVideoRecordMs: Infinity,
    loopSlots: Infinity,
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
