// Shared wheel geometry. Both the renderer (drawing + hit-test for the live
// selection) and the coordinator (audio hit-test) derive the two dial wheels
// from the canvas size; the replay player uses it in reverse to turn a recorded
// slice index back into a point that lands inside the matching slice.

export type WheelGeometry = {
  outerR: number;
  innerR: number;
  leftCx: number;
  rightCx: number;
  leftCy: number;
  rightCy: number;
  // Kept for callers (BeginnerTutorial, desktop-only) that only ever see the
  // side-by-side layout, where the two wheels share one row. Equals
  // leftCy/rightCy there; meaningless once the wheels are staggered.
  cy: number;
};

export function wheelGeometry(w: number, h: number): WheelGeometry {
  // A tall, narrow viewport (phone portrait) staggers the wheels diagonally
  // instead of side by side. Side by side, both wheels compete for the same
  // horizontal band, so a narrow screen caps their radius hard; staggered,
  // each wheel gets its own vertical band and can be much bigger.
  if (h > w) {
    const outerR = Math.min(w, h) * 0.3;
    return {
      outerR,
      innerR: outerR * 0.36,
      leftCx: outerR * 1.3,
      rightCx: w - outerR * 1.3,
      leftCy: h * 0.36,
      rightCy: h * 0.68,
      cy: h * 0.52,
    };
  }
  // Cap so the two wheels (centred at outerR*1.5 from each edge) never overlap.
  const outerR = Math.min(Math.min(w, h) * 0.24, (w - 8) / 5);
  const cy = h * 0.65;
  return {
    outerR,
    innerR: outerR * 0.36,
    leftCx: outerR * 1.5,
    rightCx: w - outerR * 1.5,
    leftCy: cy,
    rightCy: cy,
    cy,
  };
}

// Normalised (0–1) point at the centre of slice `idx` of an `n`-slice wheel,
// placed at the label radius so it sits squarely inside the annular ring. This
// is the inverse of the renderer's angleToSlicePos: feeding the result back
// through the hit-test selects exactly `idx`.
export function sliceToPoint(
  idx: number,
  n: number,
  cx: number,
  cy: number,
  outerR: number,
  w: number,
  h: number
): { x: number; y: number } {
  const midA = (idx / n) * Math.PI * 2 - Math.PI / 2;
  const r = outerR * 0.71;
  return {
    x: (cx + Math.cos(midA) * r) / w,
    y: (cy + Math.sin(midA) * r) / h,
  };
}
