import type { PlanId } from './pricingTiers.ts';

// The plan a user's access is judged by. Beta testers get Studio-level
// access regardless of billing state; the flag lives in profiles.beta_tester
// and is writable only by the service role (see 0003_entitlements.sql), so
// it can't be self-granted from the browser.
export type EffectivePlan = 'free' | PlanId;

export interface Entitlements {
  /** Piano sampler instrument (Plus+). Free is synth-only. */
  pianoUnlocked: boolean;
  /** Hard stop for the shareable-replay recorder. */
  maxReplayRecordMs: number;
  /** Hard stop for the video recorder. Infinity on Studio. */
  maxVideoRecordMs: number;
  /** Chord-loop slots the UI lets the user fill (engine caps at 8). */
  loopSlots: number;
}

const BY_PLAN: Record<EffectivePlan, Entitlements> = {
  free: {
    pianoUnlocked: false,
    maxReplayRecordMs: 20_000,
    maxVideoRecordMs: 20_000,
    loopSlots: 4,
  },
  plus: {
    pianoUnlocked: true,
    maxReplayRecordMs: 30_000,
    maxVideoRecordMs: 180_000,
    loopSlots: 8,
  },
  studio: {
    pianoUnlocked: true,
    maxReplayRecordMs: 30_000,
    maxVideoRecordMs: Infinity,
    loopSlots: 8,
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
