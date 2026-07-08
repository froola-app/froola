// Visual themes recolor the play canvas accents — wheel selection arcs, the
// extension ramp, and the two hand orbs. The wheel material itself stays
// theme-neutral (it follows light/dark via WheelPalette) so every visual
// theme reads as the same pro instrument, just re-inked.
//
// Plan-gated (Plus+, see src/entitlements.ts visualThemesUnlocked). The
// module holds the active theme so the renderer's hot loop reads a cached
// object instead of hitting localStorage per frame.

export type OrbAccent = {
  ring: string;      // crisp outline around the core
  fistRing: string;  // bright lock ring
  ghost: string;     // dashed lesson-target ring
  ghostFill: string;
  halo0: string;     // radial gradient stops, inner → outer
  halo1: string;
  halo2: string;
  core: string;
};

export interface VisualTheme {
  id: string;
  label: string;
  /** Note-wheel selection arc. */
  noteAccent: string;
  /** Extension-wheel hue ramp, start → end (hsl degrees). */
  extHue: [number, number];
  /** Extension-wheel saturation (default 90; 0 for mono). */
  extSat?: number;
  left: OrbAccent;
  right: OrbAccent;
}

// Derive a full orb accent set from one hue, matching the alpha/lightness
// relationships of the hand-tuned default orbs.
function orbAccent(hue: number, sat = 90): OrbAccent {
  const c = (s: number, l: number, a: number) => `hsla(${hue},${s}%,${l}%,${a})`;
  return {
    ring: c(sat, 52, 0.55),
    fistRing: c(sat, 68, 0.85),
    ghost: c(sat, 68, 1),
    ghostFill: c(sat, 68, 0.6),
    halo0: c(sat, 84, 0.7),
    halo1: c(sat, 52, 0.28),
    halo2: c(sat, 52, 0),
    core: c(sat, 93, 0.95),
  };
}

// The default keeps the exact hand-tuned literals the renderer shipped with,
// so "froola" is pixel-identical to the pre-theme canvas.
const FROOLA: VisualTheme = {
  id: 'froola',
  label: 'froola',
  noteAccent: '#FF9F0A',
  extHue: [211, 280],
  left: {
    ring: 'rgba(10,132,255,0.55)',
    fistRing: 'rgba(120,200,255,0.85)',
    ghost: 'rgba(120,200,255,1)',
    ghostFill: 'rgba(120,200,255,0.6)',
    halo0: 'rgba(190,225,255,0.7)',
    halo1: 'rgba(10,132,255,0.28)',
    halo2: 'rgba(10,132,255,0)',
    core: 'rgba(225,240,255,0.95)',
  },
  right: {
    ring: 'rgba(255,159,10,0.55)',
    fistRing: 'rgba(255,214,10,0.85)',
    ghost: 'rgba(255,214,10,1)',
    ghostFill: 'rgba(255,214,10,0.6)',
    halo0: 'rgba(255,235,190,0.7)',
    halo1: 'rgba(255,159,10,0.28)',
    halo2: 'rgba(255,159,10,0)',
    core: 'rgba(255,248,225,0.95)',
  },
};

export const VISUAL_THEMES: VisualTheme[] = [
  FROOLA,
  {
    id: 'ember',
    label: 'ember',
    noteAccent: 'hsl(4, 85%, 58%)',
    extHue: [4, 45],
    left: orbAccent(345, 80),
    right: orbAccent(25, 95),
  },
  {
    id: 'neon',
    label: 'neon',
    noteAccent: 'hsl(160, 95%, 48%)',
    extHue: [285, 330],
    left: orbAccent(160, 95),
    right: orbAccent(300, 95),
  },
  {
    id: 'ocean',
    label: 'ocean',
    noteAccent: 'hsl(190, 90%, 48%)',
    extHue: [190, 250],
    left: orbAccent(190, 90),
    right: orbAccent(250, 75),
  },
  {
    id: 'mono',
    label: 'mono',
    noteAccent: 'hsl(0, 0%, 62%)',
    extHue: [0, 0],
    left: orbAccent(0, 0),
    right: orbAccent(0, 0),
  },
];

const STORAGE_KEY = 'froola.visualTheme';

function load(): VisualTheme {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return VISUAL_THEMES.find(t => t.id === id) ?? FROOLA;
  } catch {
    return FROOLA;
  }
}

let current: VisualTheme = load();

export function getVisualTheme(): VisualTheme {
  return current;
}

export function setVisualTheme(id: string): VisualTheme {
  current = VISUAL_THEMES.find(t => t.id === id) ?? FROOLA;
  try { localStorage.setItem(STORAGE_KEY, current.id); } catch { /* private mode */ }
  return current;
}
