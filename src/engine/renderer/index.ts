import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, MusicalCommand } from '../types';
import { NOTES } from '../types';
import { scaleNotes, diatonicChord, EXTENSIONS, type MusicConfig } from '../music/keyScale';
import { ParticleSystem } from './particles';
import { wheelGeometry } from './geometry';

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

// Extension wheel uses a cool blue→violet ramp, distinct from the amber note wheel.
function extensionColor(i: number, n: number, alpha: number): string {
  const hue = 205 + (i / Math.max(1, n - 1)) * 95;
  return `hsla(${hue}, 70%, 62%, ${alpha})`;
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
  bgColor: string
) {
  const n = labels.length;
  const innerR = outerR * 0.36;
  const s = outerR / 180;

  // Dark backing circle
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Slices
  for (let i = 0; i < n; i++) {
    const a0 = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const isSelected = i === selectedIdx;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.closePath();
    ctx.fillStyle = isSelected && active
      ? getActiveColor(i)
      : `rgba(255,255,255,${active ? 0.06 : 0.03})`;
    if (isSelected && active) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = getActiveColor(i);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const midA = (a0 + a1) / 2;
    const lr = outerR * 0.71;
    ctx.font = (isSelected && active ? 'bold ' : '') +
      Math.round((isSelected && active ? 15 : 12) * s) + 'px monospace';
    ctx.fillStyle = isSelected && active ? '#fff' : `rgba(255,255,255,${active ? 0.45 : 0.2})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx + Math.cos(midA) * lr, cy + Math.sin(midA) * lr);
  }

  // Divider lines
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.stroke();
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(15 * s)}px monospace`;
  ctx.fillStyle = active ? '#F59E0B' : 'rgba(255,255,255,0.3)';
  ctx.fillText(centerLabel, cx, cy);
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  signal: GestureSignal,
  w: number,
  h: number,
  amplitude: number,
  isGhost = false,
) {
  const cx = signal.x * w;
  const cy = signal.y * h;
  const baseRadius = 20;
  const glowRadius = baseRadius + amplitude * 40;

  const isLeft = signal.handId === 'left';

  if (isGhost) {
    // Ghost orb: dashed ring only — shows where the target hand should be
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius * 1.4, 0, Math.PI * 2);
    ctx.strokeStyle = isLeft ? 'rgba(180,220,255,1)' : 'rgba(255,220,140,1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = isLeft ? 'rgba(180,220,255,0.6)' : 'rgba(255,220,140,0.6)';
    ctx.fill();
    ctx.restore();
    return;
  }

  const stop0 = isLeft ? 'rgba(200,230,255,0.9)' : 'rgba(255,240,200,0.9)';
  const stop1 = isLeft ? 'rgba(100,180,255,0.4)' : 'rgba(245,200,100,0.4)';
  const stop2 = isLeft ? 'rgba(100,180,255,0)'   : 'rgba(245,158,11,0)';
  const core  = isLeft ? 'rgba(200,230,255,0.95)' : 'rgba(255,248,220,0.95)';

  const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius * 2.5);
  orbGrad.addColorStop(0, stop0);
  orbGrad.addColorStop(0.3, stop1);
  orbGrad.addColorStop(1, stop2);
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Fist = chord locked: draw a bright ring around the orb
  if (signal.fist) {
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = isLeft ? 'rgba(180,220,255,0.85)' : 'rgba(255,220,140,0.85)';
    ctx.lineWidth = 2.5;
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
  // When set, the extension (qualIdx) persists while the right wheel is untouched
  // instead of snapping back to a triad — for single-pointer mouse/touch play.
  stickyExtensionRef?: RefObject<boolean>,
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
      const bgColor = 'rgba(10,14,26,0.88)';

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
      // Hold the extension while the right hand is present-but-off-ring; also
      // hold it in sticky (pointer) mode where there's no right hand at all.
      // Otherwise (camera, right hand gone) fall back to a plain triad.
      const qualIdx = rightInDial
        ? stickySlice(qualPos, EXTENSIONS.length, prevSel.qualIdx)
        : (right?.present || stickyExtensionRef?.current ? prevSel.qualIdx : 0);
      const bothActive = leftInDial && rightInDial;

      // Labels follow the selected key/scale. The note wheel shows the scale's
      // note names; the centre shows the actual diatonic chord (e.g. "Dm7").
      const music = musicRef?.current ?? { keyOffset: 0, scale: 'major' as const };
      const noteLabels = scaleNotes(music.keyOffset, music.scale).map(n => n.label);
      const chordName = diatonicChord(noteIdx, qualIdx, music.keyOffset, music.scale).label;

      // Left wheel — chord root (its major/minor quality comes from the scale)
      const leftCenterLabel = (bothActive || leftInDial) ? chordName : 'NOTE';
      drawWheel(
        ctx, leftCx, wheelCy, outerR,
        noteLabels, noteIdx, leftInDial,
        () => 'rgba(245,158,11,0.60)',
        leftCenterLabel,
        bgColor
      );

      // Right wheel — chord extension (triad / 7th / sus / …)
      drawWheel(
        ctx, rightCx, wheelCy, outerR,
        EXTENSIONS.map(e => e.label),
        qualIdx, rightInDial,
        (i) => extensionColor(i, EXTENSIONS.length, 0.60),
        rightInDial ? EXTENSIONS[qualIdx].label : 'CHORD',
        bgColor
      );

      // Publish slice selection so the coordinator can drive audio
      selectedRef.current = { noteIdx, qualIdx };

      // Ghost orbs (lesson target) drawn first so live hands appear on top
      const ghostSignals = ghostSignalsRef?.current ?? [];
      for (const gs of ghostSignals) {
        if (!gs.present) continue;
        drawOrb(ctx, gs, w, h, 0, true);
      }

      // Live orbs
      for (const signal of signals) {
        if (!signal.present) continue;
        drawOrb(ctx, signal, w, h, amplitude);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, signalsRef, analyserRef, commandRef, ghostSignalsRef, stickyExtensionRef]);
}
