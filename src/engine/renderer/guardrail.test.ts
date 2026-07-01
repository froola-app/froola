import { describe, it, expect, vi } from 'vitest';
import { drawGuardrail } from './guardrail';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '' as string,
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('drawGuardrail', () => {
  it('draws exactly two arcs (one per wheel)', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('calls save and restore to isolate drawing state', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('uses a dashed line style', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.setLineDash).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
  });
});
