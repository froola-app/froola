import { useEffect, useId, useRef } from 'react';

interface Props {
  /** Rendered width in px. */
  size?: number;
  /** 'happy' bounces the body and widens the smile each time it's set. */
  mood?: 'idle' | 'happy';
}

/**
 * Froo, the froola mascot: a little orange gumdrop with a leaf sprout, big
 * eyes and stubby arms. The pupils lazily follow the pointer (and wander
 * when it's idle), the eyes blink every few seconds, the right arm waves
 * once in a while, and the whole body bounces when something goes well.
 * Hosts the tutorial and the post-tutorial guide (see FroolaGuide).
 */
export default function FroolaMascot({ size = 56, mood = 'idle' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const eyeLRef = useRef<SVGGElement>(null);
  const eyeRRef = useRef<SVGGElement>(null);
  const pupilLRef = useRef<SVGGElement>(null);
  const pupilRRef = useRef<SVGGElement>(null);
  const wasHappy = useRef(false);
  // Gradient ids must be unique per instance — two Froos on one page (e.g.
  // tutorial + guide during a replay) would otherwise share defs.
  const uid = useId();

  // Bounce once each time the mood flips to happy.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (mood === 'happy' && !wasHappy.current) {
      root.classList.remove('is-bouncing');
      void root.offsetWidth;
      root.classList.add('is-bouncing');
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
        const maxOffset = rect.width * 0.18;

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

  const bodyGrad = `${uid}-body`;
  const armFill = '#D4500A';

  return (
    <div
      className={`froo${mood === 'happy' ? ' is-happy' : ''}`}
      ref={rootRef}
      style={{ width: size }}
      aria-hidden="true"
    >
      <svg className="froo__svg" viewBox="0 0 120 116" role="img">
        <defs>
          <radialGradient id={bodyGrad} cx="50%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#FF9F4A" />
            <stop offset="60%" stopColor="#F0701E" />
            <stop offset="100%" stopColor="#D4500A" />
          </radialGradient>
        </defs>

        {/* arms sit behind the body; the right one waves now and then */}
        <g className="froo__arm froo__arm--l">
          <ellipse cx="14" cy="82" rx="8" ry="12" fill={armFill} transform="rotate(24 14 82)" />
        </g>
        <g className="froo__arm froo__arm--r">
          <ellipse cx="106" cy="82" rx="8" ry="12" fill={armFill} transform="rotate(-24 106 82)" />
        </g>

        <g className="froo__body">
          {/* leaf sprout — froola is a little fruit at heart */}
          <g className="froo__sprout">
            <path d="M60 18 C 59 12 59 8 61 3" fill="none" stroke="#4E7A3A" strokeWidth="3" strokeLinecap="round" />
            <path d="M61 7 C 68 1 78 1 84 6 C 78 12 68 13 61 7 Z" fill="#5FA14A" />
            <path d="M60 8 C 55 3 48 2 43 5 C 47 11 55 12 60 8 Z" fill="#7CBF5E" />
          </g>

          {/* gumdrop body */}
          <path
            d="M60 14 C 90 14 106 40 106 68 C 106 96 86 110 60 110 C 34 110 14 96 14 68 C 14 40 30 14 60 14 Z"
            fill={`url(#${bodyGrad})`}
          />
          {/* soft belly sheen, tucked low so it doesn't read as a mouth */}
          <ellipse cx="60" cy="102" rx="26" ry="9" fill="#FFB067" opacity="0.22" />

          {/* face */}
          <g className="froo__eye" ref={eyeLRef}>
            <ellipse cx="43" cy="60" rx="11.5" ry="13" fill="#FFF8F0" />
            <g ref={pupilLRef}>
              <circle cx="43" cy="61" r="5.4" fill="#2B1A12" />
              <circle cx="45" cy="58.6" r="1.9" fill="#FFF8F0" />
            </g>
          </g>
          <g className="froo__eye" ref={eyeRRef}>
            <ellipse cx="77" cy="60" rx="11.5" ry="13" fill="#FFF8F0" />
            <g ref={pupilRRef}>
              <circle cx="77" cy="61" r="5.4" fill="#2B1A12" />
              <circle cx="79" cy="58.6" r="1.9" fill="#FFF8F0" />
            </g>
          </g>

          {/* blush */}
          <ellipse cx="29" cy="75" rx="6.5" ry="3.6" fill="#FF7A59" opacity="0.55" />
          <ellipse cx="91" cy="75" rx="6.5" ry="3.6" fill="#FF7A59" opacity="0.55" />

          {/* the brand smile */}
          <path
            className="froo__smile"
            d="M46 79 Q 60 92 74 79"
            fill="none"
            stroke="#FFF4E8"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
