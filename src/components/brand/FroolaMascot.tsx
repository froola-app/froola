import { useEffect, useRef } from 'react';

interface Props {
  /** Rendered width in px. */
  size?: number;
  /** 'happy' closes the eyes into content arcs and nods once each time it's set. */
  mood?: 'idle' | 'happy';
  /** When set, the pendulum keeps this tempo (one full swing = two beats).
   *  Otherwise it idles at a slow, quiet tick. */
  bpm?: number;
}

/**
 * Froo, the froola guide: a small metronome drawn in hairline ink with one
 * brand-orange accent (the pendulum weight). A metronome keeps time — which
 * is what the guide does for the player — and it gives Froo honest motion:
 * the pendulum idles at a slow tick and locks to the loop's BPM while it
 * plays. The only anthropomorphism is a pair of dot eyes that blink and
 * glance toward the pointer. Deliberately a tool with a face, not a cartoon.
 */
export default function FroolaMascot({ size = 48, mood = 'idle', bpm }: Props) {
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
        // Pupil travel stays inside the ring.
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
        pupil.style.setProperty(
          'translate',
          `${gaze[i].x.toFixed(2)}px ${gaze[i].y.toFixed(2)}px`,
        );
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
          y: (Math.random() * 2 - 1) * 0.5,
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

  // One full pendulum swing (left-right-left) spans two beats.
  const tickStyle = bpm
    ? ({ '--froo-tick': `${(120 / bpm).toFixed(3)}s` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={`froo${mood === 'happy' ? ' is-happy' : ''}`}
      ref={rootRef}
      style={{ width: size, ...tickStyle }}
      aria-hidden="true"
    >
      <svg className="froo__svg" viewBox="0 0 100 116">
        {/* metronome shell — hairline ink over a whisper of the glass fill */}
        <path
          className="froo__shell"
          d="M 39.5 10 H 60.5 Q 65.5 10 66.3 15 L 78.2 92 Q 79.5 100.5 70.8 100.5 H 29.2 Q 20.5 100.5 21.8 92 L 33.7 15 Q 34.5 10 39.5 10 Z"
          stroke="currentColor"
          strokeWidth="2.5"
        />

        {/* pendulum: ink arm, brand-orange weight; it pivots above the
            face so the swing never crosses the eyes or the smile */}
        <g className="froo__pendulum">
          <line x1="50" y1="62" x2="50" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="45.8" y="26" width="8.4" height="12" rx="2.6" fill="#D4500A" />
        </g>
        <circle cx="50" cy="62" r="2.6" fill="currentColor" />

        {/* the froola face: the wordmark's ring o-eyes and the brand smile */}
        <g className="froo__eye" ref={eyeLRef}>
          <g className="froo__eye-dot">
            <circle cx="41" cy="78" r="5.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <circle ref={pupilLRef} cx="41" cy="78" r="1.9" fill="currentColor" />
          </g>
          <path
            className="froo__eye-arc"
            d="M 35.4 79.6 Q 41 74 46.6 79.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
        <g className="froo__eye" ref={eyeRRef}>
          <g className="froo__eye-dot">
            <circle cx="59" cy="78" r="5.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <circle ref={pupilRRef} cx="59" cy="78" r="1.9" fill="currentColor" />
          </g>
          <path
            className="froo__eye-arc"
            d="M 53.4 79.6 Q 59 74 64.6 79.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
        <path
          className="froo__smile"
          d="M 43.5 89 Q 50 94.5 56.5 89"
          fill="none"
          stroke="#D4500A"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
