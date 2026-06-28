import { useEffect, useRef } from 'react';

export function useLandingCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseRef = useRef({ x: 0.5, y: 0.5, present: false });
  const lerpRef  = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf: number;
    let t = 0;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function onMove(e: MouseEvent) {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        present: true,
      };
    }
    window.addEventListener('mousemove', onMove);

    function draw() {
      t += 0.012;
      const w   = canvas!.width;
      const h   = canvas!.height;
      const ctx = canvas!.getContext('2d')!;

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

      if (mouseRef.current.present) {
        // Lerp ring chases the dot at 10% per frame
        lerpRef.current.x += (mouseRef.current.x - lerpRef.current.x) * 0.10;
        lerpRef.current.y += (mouseRef.current.y - lerpRef.current.y) * 0.10;

        const dotX  = mouseRef.current.x * w;
        const dotY  = mouseRef.current.y * h;
        const ringX = lerpRef.current.x * w;
        const ringY = lerpRef.current.y * h;

        // Outer ring — lags behind, pulses gently
        const ringR = 22 + Math.sin(t * 2.5) * 2;
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212,80,10,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner dot — exact position, solid orange
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#D4500A';
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [canvasRef]);
}
