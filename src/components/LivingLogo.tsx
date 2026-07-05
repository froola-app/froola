import { useEffect, useRef } from 'react';

interface Props {
  /** True while the cursor is near the primary CTA — the face gets excited:
   *  it nods once and holds a bigger smile until the cursor leaves. */
  excited?: boolean;
}

/**
 * The froola wordmark as a living face. The two o's are eyes whose pupils
 * follow the cursor (lazily, so it feels curious rather than watchful),
 * blink every few seconds, and wander on their own when the pointer is
 * idle or absent (touch devices). Poking the face makes it boing.
 */
export default function LivingLogo({ excited = false }: Props) {
  const faceRef = useRef<HTMLDivElement>(null);
  const eyeLRef = useRef<HTMLSpanElement>(null);
  const eyeRRef = useRef<HTMLSpanElement>(null);
  const pupilLRef = useRef<HTMLSpanElement>(null);
  const pupilRRef = useRef<HTMLSpanElement>(null);
  const wasExcited = useRef(false);

  // Nod once each time the cursor arrives near the CTA.
  useEffect(() => {
    const face = faceRef.current;
    if (!face) return;
    if (excited && !wasExcited.current) {
      face.classList.remove('is-nodding');
      // Force a reflow so re-adding the class restarts the animation.
      void face.offsetWidth;
      face.classList.add('is-nodding');
    }
    wasExcited.current = excited;
  }, [excited]);

  useEffect(() => {
    const face = faceRef.current;
    const eyes = [eyeLRef.current, eyeRRef.current];
    const pupils = [pupilLRef.current, pupilRRef.current];
    if (!face || eyes.some(e => !e) || pupils.some(p => !p)) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return;

    let pointer: { x: number; y: number } | null = null;
    let lastPointerAt = 0;
    // Wander target in [-1, 1] gaze space, used when the pointer is idle.
    let wander = { x: 0, y: 0 };
    let raf = 0;
    const gaze = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];

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

        // Lazy easing — the eyes drift toward the target instead of snapping.
        gaze[i].x += (tx - gaze[i].x) * 0.1;
        gaze[i].y += (ty - gaze[i].y) * 0.1;
        pupil.style.transform = `translate(${gaze[i].x.toFixed(2)}px, ${gaze[i].y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Blinks: single most of the time, occasionally a quick double.
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

    // Idle gaze wandering (also the only gaze on touch devices).
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

  const poke = () => {
    const face = faceRef.current;
    if (!face) return;
    face.classList.remove('is-poked');
    void face.offsetWidth;
    face.classList.add('is-poked');
  };

  return (
    <div
      className={`living-logo${excited ? ' is-excited' : ''}`}
      onPointerDown={poke}
      aria-label="froola"
      role="img"
    >
      {/* Nod/poke animate this wrapper, not the root: swapping the root's
          animation would replay its entrance animation when the class comes
          off (React rewrites className whenever `excited` changes). */}
      <div className="living-logo__face" ref={faceRef}>
      <span className="living-logo__text">fr</span>
      <span className="living-logo__eyes">
        <span className="living-logo__eye" ref={eyeLRef}>
          <span className="living-logo__pupil" ref={pupilLRef} />
        </span>
        <span className="living-logo__eye" ref={eyeRRef}>
          <span className="living-logo__pupil" ref={pupilRRef} />
        </span>
        <svg
          className="living-logo__smile"
          viewBox="0 0 100 34"
          aria-hidden="true"
        >
          <path d="M 8 8 Q 50 34 92 8" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      <span className="living-logo__text">la</span>
      </div>
    </div>
  );
}
