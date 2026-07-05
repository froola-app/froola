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
    if (eyes.some(e => !e)) return;

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
        const rect = eye.getBoundingClientRect();
        if (rect.width === 0) continue;
        // The whole dot glances, so keep the travel small and quiet.
        const maxOffset = rect.width * 0.35;

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
          const mag = Math.min(dist / (rect.width * 4), 1) * maxOffset;
          dx = (dx / dist) * mag;
          dy = (dy / dist) * mag;
          tx = dx;
          ty = dy;
        }

        gaze[i].x += (tx - gaze[i].x) * 0.1;
        gaze[i].y += (ty - gaze[i].y) * 0.1;
        eye.style.setProperty(
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
        {/* base hairline */}
        <line x1="25.5" y1="88" x2="74.5" y2="88" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />

        {/* pendulum: ink arm, brand-orange weight, pinned at the base */}
        <g className="froo__pendulum">
          <line x1="50" y1="94" x2="50" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="45.8" y="34" width="8.4" height="12" rx="2.6" fill="#D4500A" />
        </g>
        <circle cx="50" cy="94" r="3.1" fill="#D4500A" />

        {/* the face: two dot eyes beside the arm, nothing else */}
        <g className="froo__eye" ref={eyeLRef}>
          <circle className="froo__eye-dot" cx="39" cy="76" r="3" fill="currentColor" />
          <path
            className="froo__eye-arc"
            d="M 35.6 77.2 Q 39 73.6 42.4 77.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <g className="froo__eye" ref={eyeRRef}>
          <circle className="froo__eye-dot" cx="61" cy="76" r="3" fill="currentColor" />
          <path
            className="froo__eye-arc"
            d="M 57.6 77.2 Q 61 73.6 64.4 77.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
