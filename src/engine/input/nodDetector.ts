// Head-nod detection on the pitch angle extracted from MediaPipe's facial
// transformation matrix. Pure module: no React, no MediaPipe, no DOM.

/**
 * Pitch in degrees from a 16-element column-major 4x4 head-pose matrix.
 * R[row][col] = data[col*4 + row]; pitch = atan2(R[2][1], R[2][2]).
 * Contract: a pure rotation about the x-axis by θ returns θ.
 */
export function pitchFromMatrix(data: ArrayLike<number>): number {
  return Math.atan2(data[6], data[10]) * (180 / Math.PI);
}
