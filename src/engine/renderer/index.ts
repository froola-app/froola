import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, MusicalCommand } from '../types';
import { NOTES } from '../types';
import { scaleNotes, diatonicChord, EXTENSIONS, type MusicConfig } from '../music/keyScale';
import { ParticleSystem } from './particles';
import { wheelGeometry } from './geometry';
import { getVisualTheme, type VisualTheme } from './themes';

export type DialSelection = { noteIdx: number; qualIdx: number };

// Continuous slice position (0..n) of the orb around the wheel. The +π/2 offset
// puts slice 0 at the top; integer values land on slice centres.
function angleToSlicePos(orbX: number, orbY: number, cx: number, cy: number, n: number): number {
  const angle = Math.atan2(orbY - cy, orbX - cx);
  const normalized = ((angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
  return normalized / (Math.PI * 2) * n;
}

// Deadband (in slices) the orb must travel past a boundary before the selection
// flips. Stops jitter/tremor near a boundary from rapidly retriggering the audio.
const SLICE_HYSTERESIS = 0.18;

function stickySlice(pos: number, n: number, cur: number): number {
  let d = (pos - cur) % n;
  if (d < -n / 2) d += n;
  if (d >= n / 2) d -= n;
  if (Math.abs(d) > 0.5 + SLICE_HYSTERESIS) {
    return ((Math.round(pos) % n) + n) % n;
  }
  return cur;
}

// System (SF on Apple platforms) type for everything drawn on the canvas.
const UI_FONT = "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif";

// Wheel material follows the site theme (<html data-theme>, see useTheme.ts)
// so the dials match the glass HUD instead of being permanently dark.
type WheelPalette = {
  disc: string;          // translucent material disc
  hub: string;           // near-opaque center hub
  ink: (a: number) => string;  // labels / ticks / rings
  inkStrong: string;     // emphasized labels + active center chord name
};

const DARK_PALETTE: WheelPalette = {
  disc: 'rgba(22,22,24,0.58)',
  hub: 'rgba(22,22,24,0.92)',
  ink: a => `rgba(255,255,255,${a})`,
  inkStrong: '#fff',
};

const LIGHT_PALETTE: WheelPalette = {
  disc: 'rgba(250,249,246,0.62)',
  hub: 'rgba(252,251,248,0.94)',
  ink: a => `rgba(24,22,19,${a})`,
  inkStrong: 'rgba(24,22,19,0.95)',
};

function currentPalette(): WheelPalette {
  return document.documentElement.dataset.theme === 'dark'
    ? DARK_PALETTE
    : LIGHT_PALETTE;
}

// Extension wheel ramps between the theme's two hues (froola default:
// Apple system blue → purple), distinct from the note wheel accent.
function extensionColor(i: number, n: number, theme: VisualTheme): string {
  const [h0, h1] = theme.extHue;
  const hue = h0 + (i / Math.max(1, n - 1)) * (h1 - h0);
  return `hsl(${hue}, ${theme.extSat ?? 90}%, 61%)`;
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  labels: string[],
  selectedIdx: number,
  active: boolean,
  getActiveColor: (i: number) => string,
  centerLabel: string,
  pal: WheelPalette,
  // Lesson ghost target on this wheel, if any — highlighted like a selected
  // slice (in the ghost's own tint) so its label reads as "the orb is here,
  // and here's its name" instead of a dashed ring floating with no label.
  ghostIdx?: number,
  ghostColor?: string,
) {
  const n = labels.length;
  const innerR = outerR * 0.36;
  const s = outerR / 180;

  // Translucent material disc with a faint top sheen — reads like an
  // iOS overlay resting on the camera feed rather than a hole punched in it.
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 6 * s, 0, Math.PI * 2);
  ctx.fillStyle = pal.disc;
  ctx.fill();
  const sheen = ctx.createLinearGradient(cx, cy - outerR, cx, cy + outerR);
  sheen.addColorStop(0, 'rgba(255,255,255,0.055)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fill();

  // Slices: quiet wedge tint for selection/ghost (keeps the touch target
  // legible) — the loud part of the selection is the rim arc drawn below.
  for (let i = 0; i < n; i++) {
    const a0 = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const isSelected = i === selectedIdx && active;
    const isGhost = i === ghostIdx && !isSelected;

    if (isSelected || (isGhost && ghostColor)) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = isSelected ? 0.22 : 0.16;
      ctx.fillStyle = isSelected ? getActiveColor(i) : ghostColor!;
      ctx.fill();
      ctx.restore();
    }

    // Label
    const midA = (a0 + a1) / 2;
    const lr = outerR * 0.71;
    const emphasize = isSelected || isGhost;
    ctx.font = `${emphasize ? 600 : 400} ${Math.round((emphasize ? 15 : 12) * s)}px ${UI_FONT}`;
    ctx.fillStyle = emphasize ? pal.inkStrong : pal.ink(active ? 0.55 : 0.32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx + Math.cos(midA) * lr, cy + Math.sin(midA) * lr);
  }

  // Hairline boundary ticks near the rim (camera-dial style) instead of
  // full spokes — the wheel reads as one surface, not a pie chart.
  ctx.strokeStyle = pal.ink(0.28);
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (outerR - 9 * s), cy + Math.sin(a) * (outerR - 9 * s));
    ctx.lineTo(cx + Math.cos(a) * (outerR - 2 * s), cy + Math.sin(a) * (outerR - 2 * s));
    ctx.stroke();
  }

  // Outer hairline ring
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = pal.ink(active ? 0.32 : 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Selection indicator: rounded accent arc riding the rim of the selected
  // slice, inset slightly, with a small angular gap at each boundary.
  const drawRimArc = (idx: number, color: string, alpha: number) => {
    const arcR = outerR - 5 * s;
    const pad = Math.min(3.5 * s / arcR + 0.02, (Math.PI / n) * 0.35);
    const b0 = ((idx - 0.5) / n) * Math.PI * 2 - Math.PI / 2 + pad;
    const b1 = ((idx + 0.5) / n) * Math.PI * 2 - Math.PI / 2 - pad;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, b0, b1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, 3.5 * s);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  };
  if (ghostIdx !== undefined && ghostColor && !(ghostIdx === selectedIdx && active)) {
    drawRimArc(ghostIdx, ghostColor, 0.8);
  }
  if (active) drawRimArc(selectedIdx, getActiveColor(selectedIdx), 1);

  // Hub
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = pal.hub;
  ctx.fill();
  ctx.strokeStyle = pal.ink(0.16);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center label: the live chord name when active, otherwise a quiet
  // uppercase role caption ("NOTE" / "CHORD").
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (active) {
    ctx.font = `600 ${Math.round(16 * s)}px ${UI_FONT}`;
    ctx.fillStyle = pal.inkStrong;
  } else {
    ctx.font = `600 ${Math.round(10 * s)}px ${UI_FONT}`;
    ctx.fillStyle = pal.ink(0.4);
  }
  ctx.fillText(centerLabel, cx, cy);
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  signal: GestureSignal,
  w: number,
  h: number,
  amplitude: number,
  theme: VisualTheme,
  isGhost = false,
) {
  const cx = signal.x * w;
  const cy = signal.y * h;
  const baseRadius = 16;
  const glowRadius = baseRadius + amplitude * 30;

  const accent = signal.handId === 'left' ? theme.left : theme.right;

  if (isGhost) {
    // Ghost orb: dashed ring only — shows where the target hand should be
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius * 1.4, 0, Math.PI * 2);
    ctx.strokeStyle = accent.ghost;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = accent.ghostFill;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Tight halo + crisp near-white core; the amplitude still breathes the
  // radius but nothing blooms across half the screen.
  const { halo0: stop0, halo1: stop1, halo2: stop2, core } = accent;

  const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius * 2);
  orbGrad.addColorStop(0, stop0);
  orbGrad.addColorStop(0.35, stop1);
  orbGrad.addColorStop(1, stop2);
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius * 0.85, 0, Math.PI * 2);
  ctx.strokeStyle = accent.ring;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Fist = chord locked: draw a bright ring around the orb
  if (signal.fist) {
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius * 1.45, 0, Math.PI * 2);
    ctx.strokeStyle = accent.fistRing;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,
  analyserRef: RefObject<AnalyserNode | null>,
  selectedRef: RefObject<DialSelection>,
  commandRef?: RefObject<MusicalCommand | null>,
  musicRef?: RefObject<MusicConfig>,
  // Optional ghost orbs — translucent dashed rings showing lesson target positions.
  // Drawn before live orbs so live hands always appear on top.
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  guardrailRef?: RefObject<boolean>,
): void {
  const particlesRef = useRef(new ParticleSystem());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const analyser = analyserRef.current;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let rafId: number;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const signals = signalsRef.current ?? [];
      const left  = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      // Clear only — let the raw camera feed show through with no tint
      ctx.clearRect(0, 0, w, h);

      // Audio amplitude
      let amplitude = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        amplitude = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255;
      }

      const { outerR, innerR, leftCx, rightCx, cy: wheelCy } = wheelGeometry(w, h);
      // Read per frame — cheap, and it makes a theme toggle repaint instantly.
      const pal = currentPalette();
      const theme = getVisualTheme();

      // Particles — between warm zone and dials
      const presentSignals = signals.filter(s => s.present);
      const spawnX = presentSignals.length > 0
        ? presentSignals.reduce((sum, s) => sum + s.x * w, 0) / presentSignals.length
        : w / 2;
      const spawnY = presentSignals.length > 0
        ? presentSignals.reduce((sum, s) => sum + s.y * h, 0) / presentSignals.length
        : h / 2;
      const tension = commandRef?.current?.tension ?? 0;
      particlesRef.current.spawn(spawnX, spawnY, amplitude, tension);
      particlesRef.current.tick(ctx);

      // Orb positions in pixels
      const leftOrbX  = left  ? left.x  * w : leftCx;
      const leftOrbY  = left  ? left.y  * h : wheelCy;
      const rightOrbX = right ? right.x * w : rightCx;
      const rightOrbY = right ? right.y * h : wheelCy;

      // Orb touches a slice only when it is in the annular ring (innerR..outerR).
      // Inside innerR (center hub) atan2 is unstable — tiny tremors flip the
      // selected slice — so we treat that zone as inactive.
      const leftDist  = Math.hypot(leftOrbX  - leftCx,  leftOrbY  - wheelCy);
      const rightDist = Math.hypot(rightOrbX - rightCx, rightOrbY - wheelCy);
      const leftInDial  = !!left?.present  && leftDist  >= innerR && leftDist  <= outerR;
      const rightInDial = !!right?.present && rightDist >= innerR && rightDist <= outerR;

      // Slice selections with hysteresis (compute both before drawing so the left
      // wheel can show the full chord name). selectedRef persists the last choice
      // across frames, which doubles as the hysteresis state.
      const prevSel = selectedRef.current;
      const notePos = angleToSlicePos(leftOrbX, leftOrbY, leftCx, wheelCy, NOTES.length);
      const qualPos = angleToSlicePos(rightOrbX, rightOrbY, rightCx, wheelCy, EXTENSIONS.length);
      // Apply hysteresis while on the wheel; hold the last selection while the hand
      // is present but off-ring (e.g. crossing the centre hub between slices, where
      // atan2 is unstable); reset only when the hand disappears entirely.
      const noteIdx = leftInDial
        ? stickySlice(notePos, NOTES.length, prevSel.noteIdx)
        : (left?.present ? prevSel.noteIdx : 0);
      // Hold the extension while the right hand is present-but-off-ring.
      // Otherwise (right hand gone) fall back to a plain triad.
      const qualIdx = rightInDial
        ? stickySlice(qualPos, EXTENSIONS.length, prevSel.qualIdx)
        : (right?.present ? prevSel.qualIdx : 0);
      const bothActive = leftInDial && rightInDial;

      // Labels follow the selected key/scale. The note wheel shows the scale's
      // note names; the centre shows the actual diatonic chord (e.g. "Dm7").
      const music = musicRef?.current ?? { keyOffset: 0, scale: 'major' as const };
      const noteLabels = scaleNotes(music.keyOffset, music.scale).map(n => n.label);
      const chordName = diatonicChord(noteIdx, qualIdx, music.keyOffset, music.scale).label;

      // Ghost orb target slices — read before drawing the wheels so each one
      // can highlight its own ghost's slice, connecting the dashed ring to
      // the label sitting under it instead of leaving the orb unlabeled.
      const ghostSignals = ghostSignalsRef?.current ?? [];
      const leftGhost = ghostSignals.find(gs => gs.present && gs.handId === 'left');
      const rightGhost = ghostSignals.find(gs => gs.present && gs.handId === 'right');

      // Left wheel — chord root (its major/minor quality comes from the scale)
      const leftCenterLabel = (bothActive || leftInDial) ? chordName : 'NOTE';
      drawWheel(
        ctx, leftCx, wheelCy, outerR,
        noteLabels, noteIdx, leftInDial,
        () => theme.noteAccent,
        leftCenterLabel,
        pal,
        leftGhost?.sliceIdx,
        theme.left.ghost,
      );

      // Right wheel — chord extension (triad / 7th / sus / …)
      drawWheel(
        ctx, rightCx, wheelCy, outerR,
        EXTENSIONS.map(e => e.label),
        qualIdx, rightInDial,
        (i) => extensionColor(i, EXTENSIONS.length, theme),
        rightInDial ? EXTENSIONS[qualIdx].label : 'CHORD',
        pal,
        rightGhost?.sliceIdx,
        theme.right.ghost,
      );

      // Publish slice selection so the coordinator can drive audio
      selectedRef.current = { noteIdx, qualIdx };

      // Ghost orbs (lesson target) drawn first so live hands appear on top
      for (const gs of ghostSignals) {
        if (!gs.present) continue;
        drawOrb(ctx, gs, w, h, 0, theme, true);
      }

      // Live orbs
      for (const signal of signals) {
        if (!signal.present) continue;
        drawOrb(ctx, signal, w, h, amplitude, theme);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, signalsRef, analyserRef, commandRef, ghostSignalsRef, guardrailRef, musicRef, selectedRef]);
}
