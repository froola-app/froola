import { useEffect, useState } from 'react';

// The landing hero shows the actual product: the two dial wheels, drawn in
// the same visual language as the live canvas renderer, slowly playing a
// I–vi–IV–V progression by themselves. Pure SVG — no audio, no camera.

const NOTE_LABELS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const EXT_LABELS = ['triad', '6th', '7th', '9th', 'add9', 'sus2', 'sus4'];

const PROGRESSION = [
  { chord: 'C', note: 0, ext: 0 },
  { chord: 'Am7', note: 5, ext: 2 },
  { chord: 'Fadd9', note: 3, ext: 4 },
  { chord: 'G7', note: 4, ext: 2 },
];

const STEP_MS = 2600;
const R = 148;
const INNER_R = R * 0.36;

const sliceAngle = (i: number, n: number) => (i / n) * Math.PI * 2 - Math.PI / 2;

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

// Pie-wedge path for slice i (the hub circle covers the pointy centre).
function wedgePath(cx: number, cy: number, i: number, n: number): string {
  const a0 = sliceAngle(i - 0.5, n);
  const a1 = sliceAngle(i + 0.5, n);
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

// Rounded rim arc for slice i, inset from the outer ring with a small gap
// at each boundary — the selection indicator.
function rimArcPath(cx: number, cy: number, i: number, n: number): string {
  const arcR = R - 5;
  const pad = 0.045;
  const a0 = sliceAngle(i - 0.5, n) + pad;
  const a1 = sliceAngle(i + 0.5, n) - pad;
  const [x0, y0] = polar(cx, cy, arcR, a0);
  const [x1, y1] = polar(cx, cy, arcR, a1);
  return `M ${x0} ${y0} A ${arcR} ${arcR} 0 0 1 ${x1} ${y1}`;
}

function Wheel({
  cx,
  cy,
  labels,
  selected,
  accent,
  centerLabel,
  orbColors,
}: {
  cx: number;
  cy: number;
  labels: string[];
  selected: number;
  accent: (i: number) => string;
  centerLabel: string;
  orbColors: { core: string; halo: string };
}) {
  const n = labels.length;
  const [orbX, orbY] = polar(cx, cy, R * 0.88, sliceAngle(selected, n));

  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 8} fill="rgba(255,255,255,0.045)" />
      {labels.map((_, i) => {
        const a = sliceAngle(i + 0.5, n);
        const [x0, y0] = polar(cx, cy, R - 9, a);
        const [x1, y1] = polar(cx, cy, R - 2, a);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />;
      })}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />

      {/* Selection wedge tint + rim arc, crossfaded per slice */}
      {labels.map((_, i) => (
        <g key={i} style={{ opacity: i === selected ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          <path d={wedgePath(cx, cy, i, n)} fill={accent(i)} opacity="0.2" />
          <path
            d={rimArcPath(cx, cy, i, n)}
            fill="none"
            stroke={accent(i)}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Labels: regular + emphasized pair, crossfaded */}
      {labels.map((label, i) => {
        const [lx, ly] = polar(cx, cy, R * 0.71, sliceAngle(i, n));
        const on = i === selected;
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly}
              className="hero-dials__label"
              style={{ opacity: on ? 0 : 1, transition: 'opacity 0.5s ease' }}
            >
              {label}
            </text>
            <text
              x={lx}
              y={ly}
              className="hero-dials__label hero-dials__label--on"
              style={{ opacity: on ? 1 : 0, transition: 'opacity 0.5s ease' }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Orb gliding between slices */}
      <g
        style={{
          transform: `translate(${orbX}px, ${orbY}px)`,
          transition: 'transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <circle r="16" fill={orbColors.halo} opacity="0.22" />
        <circle r="7" fill={orbColors.core} />
      </g>

      {/* Hub */}
      <circle cx={cx} cy={cy} r={INNER_R} fill="#161618" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <text x={cx} y={cy} className="hero-dials__center">
        {centerLabel}
      </text>
    </g>
  );
}

export default function HeroDials() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % PROGRESSION.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const { chord, note, ext } = PROGRESSION[step];

  return (
    <svg
      className="hero-dials"
      viewBox="0 0 860 444"
      role="img"
      aria-label="The froola instrument: a note dial and a chord-extension dial"
    >
      <defs>
        <linearGradient id="hero-stage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141417" />
          <stop offset="1" stopColor="#0b0b0d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="858" height="442" rx="24" fill="url(#hero-stage)" stroke="rgba(255,255,255,0.08)" />
      <Wheel
        cx={218}
        cy={222}
        labels={NOTE_LABELS}
        selected={note}
        accent={() => '#FF9F0A'}
        centerLabel={chord}
        orbColors={{ core: '#EDF5FF', halo: '#0A84FF' }}
      />
      <Wheel
        cx={642}
        cy={222}
        labels={EXT_LABELS}
        selected={ext}
        accent={(i) => `hsl(${211 + (i / (EXT_LABELS.length - 1)) * 69}, 90%, 61%)`}
        centerLabel={EXT_LABELS[ext]}
        orbColors={{ core: '#FFF6E3', halo: '#FF9F0A' }}
      />
    </svg>
  );
}
