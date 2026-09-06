// @froola/handtrack — stable, low-latency hand signals from hand landmarks.
//
// The whole library is pure: no DOM, no React, no camera, no MediaPipe import.
// Feed it landmarks and a timestamp. See README.md for the pipeline and the
// measured behaviour of each stage.

export { HandTracker, DEFAULT_TRACKER } from './tracker';
export type { HandTrackerOptions, FrameContext } from './tracker';

export { OneEuroFilter, OneEuroPoint, alphaFor, DEFAULT_ONE_EURO } from './oneEuro';
export type { OneEuroOptions } from './oneEuro';

export { FistGate, DEFAULT_FIST_GATE } from './fist';
export type { FistGateOptions } from './fist';

export { SlotAssigner, DEFAULT_SLOT_ASSIGNER } from './slots';
export type { SlotAssignerOptions } from './slots';

export { curlScore, fingerCurl } from './curl';
export { palmCenter } from './palm';
export { classifyHandFacing, handFacingAngles, TURN_THRESHOLD_DEG, PITCH_THRESHOLD_DEG } from './facing';
export { coverTransform } from './viewport';
export type { CoverTransform } from './viewport';

export type { Landmark, Point, HandFacing, HandFrame, TrackedHand } from './types';
