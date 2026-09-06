// Frame space to target space.
//
// A camera feed rendered with `object-fit: cover` is scaled to fill the
// viewport and cropped on whichever axis is over-long. Landmarks arrive in
// frame space (0-1 of the camera image), so the same crop has to be applied to
// them or the hand and its on-screen marker drift apart toward the edges — the
// error is zero at the center and worst exactly where the wheels sit.
//
// Kept as a pure function of four numbers so it can be unit tested without a
// DOM, and so the tracker itself never has to know what a viewport is.

import type { Point } from './types';

export type CoverTransform = {
  /** Frame space (0-1, origin top-left, unmirrored) to target space (0-1). */
  map(p: Point): Point;
};

/**
 * Build the mapping for a `object-fit: cover` feed.
 *
 * @param mirror  true when the feed is displayed mirrored (`scaleX(-1)`), which
 *                is the norm for a selfie camera: the user expects to move
 *                their hand right and see it go right.
 */
export function coverTransform(
  frameW: number,
  frameH: number,
  targetW: number,
  targetH: number,
  mirror = true
): CoverTransform {
  // Degenerate sizes happen for a frame or two before video metadata loads.
  // Fall back to identity rather than producing NaN coordinates.
  if (!(frameW > 0 && frameH > 0 && targetW > 0 && targetH > 0)) {
    return { map: p => (mirror ? { x: 1 - p.x, y: p.y } : { x: p.x, y: p.y }) };
  }
  const scale = Math.max(targetW / frameW, targetH / frameH);
  const offsetX = (targetW - frameW * scale) / 2;
  const offsetY = (targetH - frameH * scale) / 2;
  return {
    map(p: Point): Point {
      const fx = mirror ? 1 - p.x : p.x;
      return {
        x: (fx * frameW * scale + offsetX) / targetW,
        y: (p.y * frameH * scale + offsetY) / targetH,
      };
    },
  };
}
