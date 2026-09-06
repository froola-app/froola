// Pure export-frame compositor. layoutFor computes all placement geometry
// (testable, no DOM); drawExportFrame paints one frame from live sources.
// The '16:9' path reproduces the legacy landscape composite exactly; the
// portrait/square paths rebuild the scene: camera full-bleed, wheels
// re-placed per the portrait mockup, chord chip, watermark.
import { wheelGeometry } from '../renderer/geometry';

export type ExportFormat = '9:16' | '1:1' | '16:9';

export const EXPORT_FORMATS: ExportFormat[] = ['9:16', '1:1', '16:9'];

export type Circle = { cx: number; cy: number; r: number };

export type ExportLayout = {
  format: ExportFormat;
  width: number;
  height: number;
  /** null on the 16:9 legacy path (wheels are already on the main canvas). */
  wheels: { src: Circle; dst: Circle }[] | null;
  /** Chord-readout chip; null on the 16:9 legacy path. */
  chip: { cx: number; y: number; fontPx: number } | null;
  watermark: { x: number; y: number; fontPx: number };
};

export function layoutFor(format: ExportFormat, srcW: number, srcH: number): ExportLayout {
  if (format === '16:9') {
    return {
      format, width: srcW, height: srcH, wheels: null, chip: null,
      watermark: { x: 16, y: srcH - 16, fontPx: Math.max(14, Math.round(srcH * 0.028)) },
    };
  }
  const width = 1080;
  const height = format === '9:16' ? 1920 : 1080;
  const g = wheelGeometry(srcW, srcH);
  const r = format === '9:16' ? width * 0.22 : width * 0.21;
  const inset = width * 0.04;
  // 9:16: offset-stack in the lower half (left wheel upper-left, right wheel
  // lower-right); 1:1: both in the bottom corners.
  const dsts: Circle[] = format === '9:16'
    ? [
        { cx: inset + r, cy: height * 0.60, r },
        { cx: width - inset - r, cy: height - inset - r, r },
      ]
    : [
        { cx: inset + r, cy: height - inset - r, r },
        { cx: width - inset - r, cy: height - inset - r, r },
      ];
  return {
    format, width, height,
    wheels: [
      { src: { cx: g.leftCx, cy: g.leftCy, r: g.outerR }, dst: dsts[0] },
      { src: { cx: g.rightCx, cy: g.rightCy, r: g.outerR }, dst: dsts[1] },
    ],
    chip: { cx: width / 2, y: height * 0.05, fontPx: Math.round(height * 0.026) },
    watermark: { x: 24, y: height - 24, fontPx: Math.max(18, Math.round(height * 0.02)) },
  };
}

/** Source crop rect that fills dstW×dstH edge-to-edge (scale-to-fill, center). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

export type ExportSources = {
  canvas: HTMLCanvasElement;
  camVideo: HTMLVideoElement | null;
  chordLabel: string;
  watermark: boolean;
};

function camReady(v: HTMLVideoElement | null): v is HTMLVideoElement {
  return !!v && v.readyState >= 2 && v.videoWidth > 0;
}

function drawWatermark(ctx: CanvasRenderingContext2D, l: ExportLayout) {
  ctx.font = `600 ${l.watermark.fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 4;
  ctx.textAlign = 'left';
  ctx.fillText('made with froola', l.watermark.x, l.watermark.y);
  ctx.shadowBlur = 0;
}

export function drawExportFrame(ctx: CanvasRenderingContext2D, l: ExportLayout, s: ExportSources): void {
  ctx.clearRect(0, 0, l.width, l.height);

  if (l.format === '16:9') {
    // Legacy landscape composite — behavior-identical to the old inline path.
    ctx.drawImage(s.canvas, 0, 0, l.width, l.height);
    if (camReady(s.camVideo)) {
      const pw = Math.floor(l.width * 0.22);
      const ph = Math.floor(pw * (s.camVideo.videoHeight / s.camVideo.videoWidth));
      const px = l.width - pw - 16;
      const py = l.height - ph - 16;
      // Mirror to match the CSS scaleX(-1) on the live feed
      ctx.save();
      ctx.translate(px + pw, py);
      ctx.scale(-1, 1);
      ctx.drawImage(s.camVideo, 0, 0, pw, ph);
      ctx.restore();
    }
    if (s.watermark) drawWatermark(ctx, l);
    return;
  }

  // Portrait/square recompose: camera full-bleed (mirrored, cover-cropped)…
  if (camReady(s.camVideo)) {
    const c = coverCrop(s.camVideo.videoWidth, s.camVideo.videoHeight, l.width, l.height);
    ctx.save();
    ctx.translate(l.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.camVideo, c.sx, c.sy, c.sw, c.sh, 0, 0, l.width, l.height);
    ctx.restore();
  } else {
    ctx.fillStyle = '#111114';
    ctx.fillRect(0, 0, l.width, l.height);
  }

  // …then each wheel blitted from the main canvas through a circular clip…
  for (const { src, dst } of l.wheels!) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(dst.cx, dst.cy, dst.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      s.canvas,
      src.cx - src.r, src.cy - src.r, src.r * 2, src.r * 2,
      dst.cx - dst.r, dst.cy - dst.r, dst.r * 2, dst.r * 2,
    );
    ctx.restore();
  }

  // …then the chord chip…
  if (s.chordLabel) {
    const { cx, y, fontPx } = l.chip!;
    ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`;
    const tw = ctx.measureText(s.chordLabel).width;
    const padX = fontPx * 0.9;
    const chipH = fontPx * 2;
    ctx.fillStyle = 'rgba(17, 17, 20, 0.55)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2 - padX, y, tw + padX * 2, chipH, chipH / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.textAlign = 'center';
    ctx.fillText(s.chordLabel, cx, y + fontPx * 1.35);
    ctx.textAlign = 'left';
  }

  if (s.watermark) drawWatermark(ctx, l);
}
