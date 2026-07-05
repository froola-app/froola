import { useEffect, useRef } from 'react';

interface Props {
  /** Face diameter in px (eyes + smile scale with it). */
  size?: number;
  /** 'happy' widens the smile and nods once each time it's set. */
  mood?: 'idle' | 'happy';
}

/**
 * The froola face on its own — the two o-eyes and the brand smile from the
 * living logo, without the letters. It blinks, its pupils lazily follow the
 * pointer (and wander when it's idle), and it nods when something goes well.
 * Used as the tutorial host and the post-tutorial guide (see FroolaGuide).
 */
export default function FroolaMascot({ size = 44, mood = 'idle' }: Props) {
  const faceRef = useRef<HTMLDivElement>(null);
  const eyeLRef = useRef<HTMLSpanElement>(null);
  const eyeRRef = useRef<HTMLSpanElement>(null);
  const pupilLRef = useRef<HTMLSpanElement>(null);
  const pupilRRef = useRef<HTMLSpanElement>(null);
  const wasHappy = useRef(false);

  // Nod once each time the mood flips to happy.
  useEffect(() => {
    const face = faceRef.current;
    if (!face) return;
    if (mood === 'happy' && !wasHappy.current) {
      face.classList.remove('is-nodding');
      void face.offsetWidth;
      face.classList.add('is-nodding');
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
        const maxOffset = rect.width * 0.17;

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
      ref={faceRef}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      <span className="froo__eye" ref={eyeLRef}>
        <span className="froo__pupil" ref={pupilLRef} />
      </span>
      <span className="froo__eye" ref={eyeRRef}>
        <span className="froo__pupil" ref={pupilRRef} />
      </span>
      <svg className="froo__smile" viewBox="0 0 100 34">
        <path d="M 8 8 Q 50 34 92 8" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
