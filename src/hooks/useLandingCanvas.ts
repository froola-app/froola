import { useEffect } from 'react';

export function useLandingCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    let t = 0;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(ctx: CanvasRenderingContext2D) {
      t += 0.012;
      const w   = canvas!.width;
      const h   = canvas!.height;

      // Background
      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, w, h);

      // Breathing orange glow at centre
      const breath = Math.sin(t * 0.5) * 0.03 + 0.06;
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
      grd.addColorStop(0, `rgba(212,80,10,${breath})`);
      grd.addColorStop(1, 'rgba(212,80,10,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(() => draw(ctx));
    }
    draw(ctx);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}
