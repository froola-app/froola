// Shared vocabulary for the tracker. Deliberately structural: a Landmark is
// whatever MediaPipe hands you, but nothing here imports MediaPipe, so the
// library can be driven by a recorded trace, a synthetic fixture, or another
// landmark source entirely.

/**
 * One landmark from a hand model.
 *
 * MediaPipe emits two flavours and they are NOT interchangeable:
 * - *normalized* landmarks are frame space (x, y in 0-1, z only "roughly"
 *   scaled by frame width), fine for 2D position and finger curl;
 * - *world* landmarks are metric 3D in meters and isotropic, which is what
 *   any real angle calculation needs.
 */
export type Landmark = { x: number; y: number; z: number };

export type Point = { x: number; y: number };

/**
 * Whether the palm is square to the camera, and if not, how it is off.
 * - `turned`: rotated sideways, like a karate chop.
 * - `pitched`: fingers angled toward or away from the camera.
 */
export type HandFacing = 'ok' | 'turned' | 'pitched';

/**
 * One hand as the landmark model reported it this frame, in frame space.
 *
 * The tracker takes raw landmarks rather than a pre-chosen point because it
 * needs to decide *which* landmark to report: an open hand tracks its index
 * fingertip, a closed one its palm center. That decision depends on the curl
 * score, which the tracker computes.
 */
export type HandFrame = {
  /** Normalized landmarks, frame space. Required. */
  landmarks: Landmark[];
  /** World landmarks (metric 3D). Required for facing classification. */
  worldLandmarks?: Landmark[];
};

/** One hand after filtering, slot assignment, and gating. */
export type TrackedHand = {
  /** Which slot this hand drives, stable across frames. */
  slot: number;
  /** Filtered position in target space. */
  x: number;
  y: number;
  /** Filtered velocity, target-space units per second. */
  vx: number;
  vy: number;
  /** Continuous curl: 0 is a flat open hand, 1 is a tight fist. */
  curl: number;
  /** Debounced fist state. Hysteretic, so it does not chatter at threshold. */
  fist: boolean;
  facing: HandFacing;
  /**
   * True while this hand is reported from memory because detection dropped
   * out for a frame or two. Consumers that draw confidence (or mute audio)
   * can treat a coasting hand differently; most can ignore it.
   */
  coasting: boolean;
};
