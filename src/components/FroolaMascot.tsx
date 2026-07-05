import { useEffect, useRef } from 'react';

interface Props {
  /** Rendered width in px. */
  size?: number;
  /** 'happy' widens the smile and nods once each time it's set. */
  mood?: 'idle' | 'happy';
}

/**
 * Froo, the froola guide: the wordmark's face — the two o-eyes and the brand
 * smile — set in a glass pebble made of the same liquid-glass material as
 * the HUD (see the --lg-* variables in App.css). Deliberately restrained:
 * it blinks, the pupils lazily follow the pointer (wandering when it's
 * idle), and it nods once when something goes well. No limbs, no costume —
 * it's the product mark come alive, not a cartoon character.
 */
export default function FroolaMascot({ size = 48, mood = 'idle' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const eyeLRef = useRef<SVGGElement>(null);
  const eyeRRef = useRef<SVGGElement>(null);
  const pupilLRef = useRef<SVGCircleElement>(null);
  const pupilRRef = useRef<SVGCircleElement>(null);
  const wasHappy = useRef(false);

  // Nod once each time the mood flips to happy.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (mood === 'happy' && !wasHappy.current) {
      root.classList.remove('is-nodding');
      void root.offsetWidth;
      root.classList.add('is-nodding');
    }
    wasHappy.current = mood === 'happy';
  }, [mood]);

  useEffect(() => {
    const eyes = [eyeLRef.current, eyeRRef.current];
    const pupils = [pupilLRef.current, pupilRRef.current];
    if (eyes.some(e => !e) || pupils.some(p => !p)) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return;

    let pointer: { x: number; y: number } | null = null;
    let lastPointerAt = 0;
    let wander = { x: 0, y: 0 };
    let raf = 0;
    const gaze = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

    const onPointerMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      lastPointerAt = performance.now();
    };

    const tick = () => {
      const now = performance.now();
      const pointerIdle = !pointer || now - lastPointerAt > 4000;

      for (let i = 0; i < 2; i++) {
        const eye = eyes[i]!;
        const pupil = pupils[i]!;
        const rect = eye.getBoundingClientRect();
        if (rect.width === 0) continue;
        const maxOffset = rect.width * 0.16;

        let tx: number;
        let ty: number;
        if (pointerIdle) {
          tx = wander.x * maxOffset;
          ty = wander.y * maxOffset;
        } else {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let dx = pointer!.x - cx;
          let dy = pointer!.y - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const mag = Math.min(dist / (rect.width * 1.5), 1) * maxOffset;
          dx = (dx / dist) * mag;
          dy = (dy / dist) * mag;
          tx = dx;
          ty = dy;
        }

        gaze[i].x += (tx - gaze[i].x) * 0.1;
        gaze[i].y += (ty - gaze[i].y) * 0.1;
        pupil.style.transform = `translate(${gaze[i].x.toFixed(2)}px, ${gaze[i].y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    let blinkTimer = 0;
    const blink = (thenDouble: boolean) => {
      for (const eye of eyes) eye!.classList.add('is-blinking');
      window.setTimeout(() => {
        for (const eye of eyes) eye!.classList.remove('is-blinking');
        if (thenDouble) window.setTimeout(() => blink(false), 140);
      }, 130);
    };
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        blink(Math.random() < 0.18);
        scheduleBlink();
      }, 2800 + Math.random() * 3200);
    };
    scheduleBlink();

    let wanderTimer = 0;
    const scheduleWander = () => {
      wanderTimer = window.setTimeout(() => {
        wander = {
          x: (Math.random() * 2 - 1) * 0.9,
          y: (Math.random() * 2 - 1) * 0.6,
        };
        scheduleWander();
      }, 1800 + Math.random() * 2600);
    };
    scheduleWander();

    window.addEventListener('pointermove', onPointerMove);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(blinkTimer);
      clearTimeout(wanderTimer);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return (
    <div
      className={`froo${mood === 'happy' ? ' is-happy' : ''}`}
      ref={rootRef}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="froo__svg" viewBox="0 0 100 100">
        {/* the wordmark's two o's, in the theme ink */}
        <g className="froo__eye" ref={eyeLRef}>
          <circle cx="33" cy="42" r="13" fill="none" stroke="currentColor" strokeWidth="6.5" />
          <circle ref={pupilLRef} cx="33" cy="42" r="4.2" fill="currentColor" />
        </g>
        <g className="froo__eye" ref={eyeRRef}>
          <circle cx="67" cy="42" r="13" fill="none" stroke="currentColor" strokeWidth="6.5" />
          <circle ref={pupilRRef} cx="67" cy="42" r="4.2" fill="currentColor" />
        </g>
        {/* the brand smile — the one bold move, same as everywhere else */}
        <path
          className="froo__smile"
          d="M33 68 Q 50 82 67 68"
          fill="none"
          stroke="#D4500A"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
