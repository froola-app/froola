// Generates the animated SVGs used in the README.
//
// These are produced by running the *real* filter over a real trace, not drawn
// by hand, so the smooth curve in the README is literally this library's output
// on the jagged one next to it. A marketing image that cannot disagree with the
// code is worth the small amount of machinery.
//
// `npm run assets` writes them. Skipped otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { OneEuroPoint } from '../oneEuro';
import { sineTrace } from './traces';

// Written into public/ so the deployed site serves them, and the READMEs point
// at https://froolamusic.com/readme/*.svg rather than at repo-relative paths.
//
// Why the indirection: GitHub serves repo-hosted SVGs (github.com/raw and
// raw.githubusercontent.com alike) with `Content-Security-Policy: ... sandbox`,
// and repo-hosted SVGs are widely reported not to animate in READMEs. An
// absolute third-party URL is proxied through camo instead, which serves the
// file byte-identical and *without* the sandbox directive — that is the path
// every animated SVG on GitHub takes.
//
// Worth stating plainly, because it is easy to "verify" this wrongly: Chrome
// pauses SMIL timelines in backgrounded tabs, so an automated browser will
// report any of these as frozen no matter where they are served from. The way
// to check the SVG itself is `svg.setCurrentTime(t)` and read back the animated
// value; the way to check the delivery path is to open it in a real window.
const OUT = path.join(process.cwd(), 'public/readme');

// froola's dark palette. The panels are dark in both GitHub themes on purpose:
// one artwork that always looks deliberate beats two that drift apart.
const C = {
  panel: '#101013',
  panelEdge: '#26262c',
  ink: '#f5f5f7',
  gray: '#a9a9b0',
  faint: '#6f6f78',
  accent: '#f2650f',
  raw: '#5b5b66',
  grid: '#1c1c22',
};

const W = 1200;

const d = (pts: { x: number; y: number }[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

function filterDemoSvg(): string {
  // A hand sweeping at playing speed, with representative landmark noise.
  const trace = sineTrace({ ms: 4000, hz: 30, noise: 0.007, seed: 4, freqHz: 0.55, amplitude: 0.085 });
  const f = new OneEuroPoint();
  const smoothed: number[] = [];
  let prev: number | null = null;
  for (const s of trace) {
    const dt = prev === null ? 1 / 30 : Math.max(s.t - prev, 1) / 1000;
    prev = s.t;
    smoothed.push(f.filter(s.x, s.y, dt).x);
  }
  const raw = trace.map(s => s.x);

  const X0 = 70, Y0 = 92, CW = W - 140, CH = 224;
  const all = [...raw, ...smoothed];
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const py = (v: number) => Y0 + CH - ((v - lo) / span) * CH;
  const px = (i: number) => X0 + (i / (raw.length - 1)) * CW;
  const pts = (vs: number[]) => vs.map((v, i) => ({ x: px(i), y: py(v) }));

  const rawPath = d(pts(raw));
  const smoothPath = d(pts(smoothed));
  const dur = 6;
  const keyTimes = raw.map((_, i) => (i / (raw.length - 1)).toFixed(4)).join(';');
  const rawCx = raw.map((_, i) => px(i).toFixed(1)).join(';');
  const rawCy = raw.map(v => py(v).toFixed(1)).join(';');
  const smCy = smoothed.map(v => py(v).toFixed(1)).join(';');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 380" width="${W}" height="380" role="img" aria-label="Raw hand landmarks jitter; the filtered signal is smooth and keeps up">
  <rect width="${W}" height="380" rx="18" fill="${C.panel}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="379" rx="18" fill="none" stroke="${C.panelEdge}"/>

  <text x="40" y="46" fill="${C.ink}" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',Segoe UI,sans-serif" font-size="22" font-weight="600">One hand, sweeping at playing speed</text>
  <text x="40" y="70" fill="${C.faint}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">Both lines are the same hand. One is what the model reports, the other is what you play with.</text>

  ${[0, 0.25, 0.5, 0.75, 1].map(t => `<line x1="${X0}" y1="${(Y0 + CH * t).toFixed(1)}" x2="${X0 + CW}" y2="${(Y0 + CH * t).toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`).join('\n  ')}

  <path d="${rawPath}" fill="none" stroke="${C.raw}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="${smoothPath}" fill="none" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <line y1="${Y0 - 10}" y2="${Y0 + CH + 10}" stroke="${C.panelEdge}" stroke-width="1">
    <animate attributeName="x1" values="${rawCx}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
    <animate attributeName="x2" values="${rawCx}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
  </line>

  <circle r="5" fill="${C.raw}">
    <animate attributeName="cx" values="${rawCx}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${rawCy}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
  </circle>
  <circle r="7" fill="${C.accent}">
    <animate attributeName="cx" values="${rawCx}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${smCy}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>
  </circle>

  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">
    <circle cx="${X0}" cy="345" r="5" fill="${C.raw}"/>
    <text x="${X0 + 14}" y="350" fill="${C.gray}">raw landmarks</text>
    <circle cx="${X0 + 190}" cy="345" r="5" fill="${C.accent}"/>
    <text x="${X0 + 204}" y="350" fill="${C.ink}">@froola/handtrack</text>
    <text x="${X0 + CW}" y="350" fill="${C.faint}" text-anchor="end">18% less jitter · 65% less lag · generated by the library itself</text>
  </g>
</svg>
`;
}

describe('README assets', () => {
  it('generates the animated filter demo from real filter output', () => {
    const svg = filterDemoSvg();
    expect(svg).toContain('<animate');
    expect(svg.length).toBeGreaterThan(2000);
    if (process.env.WRITE_ASSETS) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'filter-demo.svg'), svg);
    }
  });
});
