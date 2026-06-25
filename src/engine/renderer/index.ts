import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../types';

export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  gestureRef: RefObject<GestureSignal>,
  analyser: AnalyserNode | null
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
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
      const signal = gestureRef.current!;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0A0E1A';
      ctx.fillRect(0, 0, w, h);

      // Warm zone — static amber radial gradient centered (SP2 will drive this from tension)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.18)');   // #F59E0B
      grad.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');  // #D97706
      grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (!signal.present) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Audio amplitude → orb glow radius
      let amplitude = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const sum = freqData.reduce((a, b) => a + b, 0);
        amplitude = sum / freqData.length / 255; // 0–1
      }

      const cx = signal.x * w;
      const cy = signal.y * h;
      const baseRadius = 20;
      const glowRadius = baseRadius + amplitude * 40;

      // Glow halo
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius * 2.5);
      orbGrad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
      orbGrad.addColorStop(0.3, 'rgba(245, 200, 100, 0.4)');
      orbGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core orb
      ctx.fillStyle = 'rgba(255, 248, 220, 0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, gestureRef, analyser]);
}
