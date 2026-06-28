import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FroolaLogo from './FroolaLogo';

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: 0.5, y: 0.5, present: false });

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

      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, w, h);

      const breath = Math.sin(t * 0.5) * 0.03 + 0.06;
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
      grd.addColorStop(0, `rgba(212,80,10,${breath})`);
      grd.addColorStop(1, 'rgba(212,80,10,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      if (mouseRef.current.present) {
        const cx = mouseRef.current.x * w;
        const cy = mouseRef.current.y * h;
        const r  = 14 + Math.sin(t * 2) * 2;

        const shadow = ctx.createRadialGradient(cx, cy + 4, 0, cx, cy, r * 4);
        shadow.addColorStop(0, 'rgba(0,0,0,0.08)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
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
  }, []);

  return (
    <div className="landing-v2">
      <canvas ref={canvasRef} className="landing-v2__canvas" />
      <div className="landing-v2__ui">
        <FroolaLogo size={72} />
        <p className="landing-v2__tagline">play music with your hands</p>
        <div className="landing-v2__actions">
          <button className="landing-v2__btn-primary" onClick={() => navigate('/play')}>
            Play →
          </button>
        </div>
        <p className="landing-v2__privacy">Your camera never leaves your device.</p>
      </div>
    </div>
  );
}
