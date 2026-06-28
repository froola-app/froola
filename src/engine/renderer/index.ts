import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, ChordQuality } from '../types';
import { NOTES, QUALITIES } from '../types';

export type DialSelection = { noteIdx: number; qualIdx: number };

const QUALITY_LABELS: Record<ChordQuality, string> = {
  major: 'maj', minor: 'min', maj7: 'M7', min7: 'm7', dom7: '7', aug: 'aug', dim: 'dim',
};

function angleToSlice(orbX: number, orbY: number, cx: number, cy: number, n: number): number {
  const angle = Math.atan2(orbY - cy, orbX - cx);
  const normalized = ((angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
  // Math.round centres the hit-region on each visual slice rather than
  // starting at its left edge (which would shift selection half a slice clockwise).
  return Math.round(normalized / (Math.PI * 2) * n) % n;
}

function qualitySliceColor(q: ChordQuality, alpha: number): string {
  if (q === 'major' || q === 'maj7') return `rgba(245,158,11,${alpha})`;
  if (q === 'dom7')                  return `rgba(255,130,50,${alpha})`;
  if (q === 'minor' || q === 'min7') return `rgba(74,158,255,${alpha})`;
  return                                    `rgba(184,122,255,${alpha})`;
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  labels: string[],
  selectedIdx: number,
  active: boolean,
  getActiveColor: (i: number) => string,
  centerLabel: string,
  bgColor: string
) {
  const n = labels.length;
  const innerR = outerR * 0.36;
  const s = outerR / 180;

  // Dark backing circle
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Slices
  for (let i = 0; i < n; i++) {
    const a0 = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const isSelected = i === selectedIdx;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.closePath();
    ctx.fillStyle = isSelected && active
      ? getActiveColor(i)
      : `rgba(255,255,255,${active ? 0.06 : 0.03})`;
    if (isSelected && active) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = getActiveColor(i);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const midA = (a0 + a1) / 2;
    const lr = outerR * 0.71;
    ctx.font = (isSelected && active ? 'bold ' : '') +
      Math.round((isSelected && active ? 15 : 12) * s) + 'px monospace';
    ctx.fillStyle = isSelected && active ? '#fff' : `rgba(255,255,255,${active ? 0.45 : 0.2})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx + Math.cos(midA) * lr, cy + Math.sin(midA) * lr);
  }

  // Divider lines
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.stroke();
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(15 * s)}px monospace`;
  ctx.fillStyle = active ? '#F59E0B' : 'rgba(255,255,255,0.3)';
  ctx.fillText(centerLabel, cx, cy);
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  signal: GestureSignal,
  w: number,
  h: number,
  amplitude: number
) {
  const cx = signal.x * w;
  const cy = signal.y * h;
  const baseRadius = 20;
  const glowRadius = baseRadius + amplitude * 40;

  const isLeft = signal.handId === 'left';
  const stop0 = isLeft ? 'rgba(200,230,255,0.9)' : 'rgba(255,240,200,0.9)';
  const stop1 = isLeft ? 'rgba(100,180,255,0.4)' : 'rgba(245,200,100,0.4)';
  const stop2 = isLeft ? 'rgba(100,180,255,0)'   : 'rgba(245,158,11,0)';
  const core  = isLeft ? 'rgba(200,230,255,0.95)' : 'rgba(255,248,220,0.95)';

  const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius * 2.5);
  orbGrad.addColorStop(0, stop0);
  orbGrad.addColorStop(0.3, stop1);
  orbGrad.addColorStop(1, stop2);
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();
}

export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,
  analyserRef: RefObject<AnalyserNode | null>,
  selectedRef: RefObject<DialSelection>
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const analyser = analyserRef.current;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let rafId: number;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const signals = signalsRef.current ?? [];
      const left  = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      // Transparent background — let the camera feed show through
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10,14,26,0.50)';
      ctx.fillRect(0, 0, w, h);

      // Warm zone gradient (SP2 will drive color from tension)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
      grad.addColorStop(0, 'rgba(245,158,11,0.18)');
      grad.addColorStop(0.6, 'rgba(217,119,6,0.08)');
      grad.addColorStop(1, 'rgba(217,119,6,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Audio amplitude
      let amplitude = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        amplitude = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255;
      }

      const outerR = Math.min(w, h) * 0.24;
      const leftCx  = outerR + 20;
      const rightCx = w - outerR - 20;
      const wheelCy = h / 2;
      const bgColor = 'rgba(10,14,26,0.88)';

      // Orb positions in pixels
      const leftOrbX  = left  ? left.x  * w : leftCx;
      const leftOrbY  = left  ? left.y  * h : wheelCy;
      const rightOrbX = right ? right.x * w : rightCx;
      const rightOrbY = right ? right.y * h : wheelCy;

      // Orb touches a slice only when it is in the annular ring (innerR..outerR).
      // Inside innerR (center hub) atan2 is unstable — tiny tremors flip the
      // selected slice — so we treat that zone as inactive.
      const innerR    = outerR * 0.36;
      const leftDist  = Math.hypot(leftOrbX  - leftCx,  leftOrbY  - wheelCy);
      const rightDist = Math.hypot(rightOrbX - rightCx, rightOrbY - wheelCy);
      const leftInDial  = !!left?.present  && leftDist  >= innerR && leftDist  <= outerR;
      const rightInDial = !!right?.present && rightDist >= innerR && rightDist <= outerR;

      // Left wheel — note selection by angle, active only when orb is touching the dial
      const noteIdx = left?.present ? angleToSlice(leftOrbX, leftOrbY, leftCx, wheelCy, NOTES.length) : 0;
      drawWheel(
        ctx, leftCx, wheelCy, outerR,
        NOTES, noteIdx, leftInDial,
        () => 'rgba(245,158,11,0.60)',
        leftInDial ? NOTES[noteIdx] : 'NOTE',
        bgColor
      );

      // Right wheel — chord quality selection by angle, active only when orb is touching the dial
      const qualIdx = right?.present ? angleToSlice(rightOrbX, rightOrbY, rightCx, wheelCy, QUALITIES.length) : 0;
      drawWheel(
        ctx, rightCx, wheelCy, outerR,
        QUALITIES.map(q => QUALITY_LABELS[q]),
        qualIdx, rightInDial,
        (i) => qualitySliceColor(QUALITIES[i], 0.60),
        rightInDial ? QUALITY_LABELS[QUALITIES[qualIdx]] : 'CHORD',
        bgColor
      );

      // Publish slice selection so the coordinator can drive audio
      selectedRef.current = { noteIdx, qualIdx };

      // Orbs
      for (const signal of signals) {
        if (!signal.present) continue;
        drawOrb(ctx, signal, w, h, amplitude);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, signalsRef, analyserRef]);
}
