import { useEffect } from 'react';

const ORANGE = '212,80,10';

interface Note {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
}

/**
 * Editorial-light backdrop for the landing page: a warm off-white field with a
 * slow breathing orange glow, plus a handful of soft "notes" drifting upward to
 * hint at the music without competing with the foreground copy. Honors
 * prefers-reduced-motion by holding the glow steady and parking the notes.
 */
export function useLandingCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    let notes: Note[] = [];

    function seedNotes() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = Math.round(Math.min(22, Math.max(8, (w * h) / 90000)));
      notes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.5 + Math.random() * 3.5,
        vy: 0.08 + Math.random() * 0.22,
        drift: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.05 + Math.random() * 0.1,
      }));
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      seedNotes();
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;

      // Warm off-white field
      ctx!.fillStyle = '#FAFAF8';
      ctx!.fillRect(0, 0, w, h);

      // Breathing orange glow, biased toward the upper third where the hero sits
      const breath = reduced ? 0.06 : Math.sin(t * 0.5) * 0.03 + 0.06;
      const cx = w / 2;
      const cy = h * 0.34;
      const grd = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.7);
      grd.addColorStop(0, `rgba(${ORANGE},${breath})`);
      grd.addColorStop(1, `rgba(${ORANGE},0)`);
      ctx!.fillStyle = grd;
      ctx!.fillRect(0, 0, w, h);

      // Drifting notes
      for (const n of notes) {
        if (!reduced) {
          n.y -= n.vy;
          n.x += Math.sin(t + n.phase) * n.drift * 0.4;
          if (n.y + n.r < 0) {
            n.y = h + n.r;
            n.x = Math.random() * w;
          }
        }
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${ORANGE},${n.alpha})`;
        ctx!.fill();
      }

      if (reduced) return;
      t += 0.012;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}
