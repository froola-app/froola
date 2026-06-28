import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, NoteName, ChordQuality } from '../types';

const NOTES: NoteName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

function pickIndex(x: number, count: number): number {
  return Math.min(Math.floor(x * count), count - 1);
}

function drawDial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  labels: string[],
  selectedIndex: number,
  active: boolean
) {
  const itemH = height / labels.length;
  labels.forEach((label, i) => {
    const isSelected = i === selectedIndex;
    const cy = y + i * itemH + itemH / 2;

    if (isSelected && active) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(x, y + i * itemH, width, itemH);
    }

    ctx.font = isSelected && active ? 'bold 16px monospace' : '14px monospace';
    ctx.fillStyle = isSelected && active ? '#F59E0B' : 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, cy);
  });

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText(x < ctx.canvas.width / 2 ? 'NOTE' : 'CHORD', x + width / 2, y - 14);
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
  const stop0 = isLeft ? 'rgba(200, 230, 255, 0.9)' : 'rgba(255, 240, 200, 0.9)';
  const stop1 = isLeft ? 'rgba(100, 180, 255, 0.4)' : 'rgba(245, 200, 100, 0.4)';
  const stop2 = isLeft ? 'rgba(100, 180, 255, 0)'   : 'rgba(245, 158, 11, 0)';
  const core  = isLeft ? 'rgba(200, 230, 255, 0.95)' : 'rgba(255, 248, 220, 0.95)';

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
  analyserRef: RefObject<AnalyserNode | null>
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

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0A0E1A';
      ctx.fillRect(0, 0, w, h);

      // Warm zone — static amber radial gradient centered (SP2 will drive this from tension)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
      grad.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');
      grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      let amplitude = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const sum = freqData.reduce((a, b) => a + b, 0);
        amplitude = sum / freqData.length / 255;
      }

      const DIAL_W = w * 0.15;

      // Left dial — note selection
      const noteIdx = left ? pickIndex(left.x, NOTES.length) : 0;
      drawDial(ctx, 0, 40, DIAL_W, h - 80, NOTES, noteIdx, !!left?.present);

      // Right dial — chord quality selection
      const qualIdx = right ? pickIndex(right.x, QUALITIES.length) : 0;
      drawDial(ctx, w - DIAL_W, 40, DIAL_W, h - 80, QUALITIES, qualIdx, !!right?.present);

      // Orbs for each present hand
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
