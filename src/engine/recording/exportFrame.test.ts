import { describe, it, expect, vi, beforeEach } from 'vitest';
import { layoutFor, coverCrop, drawExportFrame, EXPORT_FORMATS } from './exportFrame';
import { wheelGeometry } from '../renderer/geometry';

beforeEach(() => vi.clearAllMocks());

describe('layoutFor', () => {
  it('sizes each format', () => {
    expect(layoutFor('9:16', 1280, 800)).toMatchObject({ width: 1080, height: 1920 });
    expect(layoutFor('1:1', 1280, 800)).toMatchObject({ width: 1080, height: 1080 });
    expect(layoutFor('16:9', 1280, 800)).toMatchObject({ width: 1280, height: 800 });
  });

  it('16:9 is the legacy path: no recompose placements', () => {
    const l = layoutFor('16:9', 1280, 800);
    expect(l.wheels).toBeNull();
    expect(l.chip).toBeNull();
  });

  it('portrait wheel sources come from wheelGeometry of the source canvas', () => {
    const l = layoutFor('9:16', 1280, 800);
    const g = wheelGeometry(1280, 800);
    expect(l.wheels![0].src).toEqual({ cx: g.leftCx, cy: g.leftCy, r: g.outerR });
    expect(l.wheels![1].src).toEqual({ cx: g.rightCx, cy: g.rightCy, r: g.outerR });
  });

  it('portrait/square destination wheels fit fully inside the frame', () => {
    for (const format of ['9:16', '1:1'] as const) {
      const l = layoutFor(format, 1280, 800);
      for (const { dst } of l.wheels!) {
        expect(dst.cx - dst.r).toBeGreaterThanOrEqual(0);
        expect(dst.cx + dst.r).toBeLessThanOrEqual(l.width);
        expect(dst.cy - dst.r).toBeGreaterThanOrEqual(0);
        expect(dst.cy + dst.r).toBeLessThanOrEqual(l.height);
      }
    }
  });

  it('destination wheels never overlap each other', () => {
    for (const format of ['9:16', '1:1'] as const) {
      const l = layoutFor(format, 1280, 800);
      const [a, b] = l.wheels!.map(w => w.dst);
      const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      expect(dist).toBeGreaterThanOrEqual(a.r + b.r);
    }
  });

  it('exports the formats in toggle order', () => {
    expect(EXPORT_FORMATS).toEqual(['9:16', '1:1', '16:9']);
  });
});

describe('coverCrop', () => {
  it('crops width when source is wider than destination aspect', () => {
    // 1600x900 source into 1080x1920 (much taller): full height kept, width cropped
    const c = coverCrop(1600, 900, 1080, 1920);
    expect(c.sh).toBe(900);
    expect(c.sw).toBeCloseTo(900 * (1080 / 1920), 5);
    expect(c.sx).toBeCloseTo((1600 - c.sw) / 2, 5);
    expect(c.sy).toBe(0);
  });

  it('crops height when source is taller than destination aspect', () => {
    const c = coverCrop(1000, 2000, 1080, 1080);
    expect(c.sw).toBeCloseTo(1000, 5);
    expect(c.sh).toBeCloseTo(1000, 5);
    expect(c.sy).toBeCloseTo(500, 5);
  });
});

describe('drawExportFrame', () => {
  function mockCtx() {
    return {
      clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
      clip: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
      roundRect: vi.fn(), measureText: vi.fn().mockReturnValue({ width: 100 }),
      set font(_: string) {}, set fillStyle(_: string) {},
      set shadowColor(_: string) {}, set shadowBlur(_: number) {},
      set textAlign(_: string) {},
    } as unknown as CanvasRenderingContext2D;
  }
  const canvas = { width: 1280, height: 800 } as HTMLCanvasElement;

  it('16:9 draws the main canvas full-frame first', () => {
    const ctx = mockCtx();
    drawExportFrame(ctx, layoutFor('16:9', 1280, 800), { canvas, camVideo: null, chordLabel: 'C', watermark: false });
    expect(ctx.drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1280, 800);
  });

  it('9:16 clips each wheel to a circle (two clip calls)', () => {
    const ctx = mockCtx();
    drawExportFrame(ctx, layoutFor('9:16', 1280, 800), { canvas, camVideo: null, chordLabel: 'Cmaj7', watermark: false });
    expect(ctx.clip).toHaveBeenCalledTimes(2);
  });

  it('draws the watermark only when asked', () => {
    const ctx = mockCtx();
    drawExportFrame(ctx, layoutFor('9:16', 1280, 800), { canvas, camVideo: null, chordLabel: 'C', watermark: true });
    expect(ctx.fillText).toHaveBeenCalledWith('made with froola', expect.any(Number), expect.any(Number));
  });

  it('skips the camera layer when the video is not ready', () => {
    const ctx = mockCtx();
    const notReady = { readyState: 0, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    // must not throw, and must still draw wheels
    drawExportFrame(ctx, layoutFor('9:16', 1280, 800), { canvas, camVideo: notReady, chordLabel: 'C', watermark: false });
    expect(ctx.clip).toHaveBeenCalledTimes(2);
  });
});
