import { wheelGeometry } from './geometry';

export function drawGuardrail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
): void {
  const { outerR, leftCx, rightCx, cy } = wheelGeometry(w, h);
  const alpha = 0.12 + 0.08 * Math.sin(now / 600);

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);

  ctx.beginPath();
  ctx.arc(leftCx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(rightCx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
