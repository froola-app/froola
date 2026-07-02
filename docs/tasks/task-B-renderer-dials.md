# Task B — Visual Dial Renderer (Two-Hand Control)

## Who This Is For
**Your coworker's Claude.** Dennis is separately wiring up the input layer and coordinator (Task A).  
Do NOT touch `src/engine/input/index.ts` or `src/coordinator.ts` — those are Task A.

---

## Project Overview

Froola is a gesture-controlled music instrument. Users move their hands in front of a camera and MediaPipe tracks them. We are adding **two-hand control** with two visual dials on screen:

- **Left hand** → selects a **root note** (A B C D E F G) — left-side dial
- **Right hand** → selects a **chord quality** (major, minor, maj7, min7, dom7, aug, dim) — right-side dial

Your job: update the Canvas2D renderer to draw these two dials and show the hand orbs.

---

## File You Own

```
src/engine/renderer/index.ts
```

---

## Current Renderer (for reference)

The current renderer (`src/engine/renderer/index.ts`) takes a single `GestureSignal` ref and draws one orb. It uses Canvas2D — no libraries, just `ctx`.

```typescript
export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  gestureRef: RefObject<GestureSignal>,       // ← this will change
  analyserRef: RefObject<AnalyserNode | null>
): void
```

---

## Updated Types (Task A will produce these — assume they exist)

```typescript
// src/engine/types.ts — after Task A's changes

export type GestureSignal = {
  x: number;        // 0–1, horizontal position
  y: number;        // 0–1, vertical position
  present: boolean;
  handId: 'left' | 'right';   // was: 'primary' | 'secondary'
};

export type NoteName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type ChordQuality = 'major' | 'minor' | 'maj7' | 'min7' | 'dom7' | 'aug' | 'dim';
```

---

## New Renderer Signature

Change `gestureRef` from a single signal to an array:

```typescript
export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,     // ← was RefObject<GestureSignal>
  analyserRef: RefObject<AnalyserNode | null>
): void
```

---

## What to Draw

Each frame, read `signalsRef.current` and find the left and right hand:

```typescript
const signals = signalsRef.current ?? [];
const left  = signals.find(s => s.handId === 'left');
const right = signals.find(s => s.handId === 'right');
```

### Layout

```
|  LEFT DIAL  |      CENTER       |  RIGHT DIAL  |
| (note A–G)  |  (background +    | (chord qual) |
|             |   orb per hand)   |              |
```

- Left dial: vertical strip on the left ~15% of canvas width
- Right dial: vertical strip on the right ~15% of canvas width
- Center: existing background + warm zone, plus orb for each present hand

### Dial Design

A dial is a vertical list of options. The hand's `x` position selects which option is active (since hand x maps to which item in the list — left=0, right=1 across 7 items).

```typescript
const NOTES: NoteName[]      = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

function pickIndex(x: number, count: number): number {
  return Math.min(Math.floor(x * count), count - 1);
}
```

Draw each dial as a vertical list of labels. Highlight the selected item with a warm amber color (`#F59E0B`), others in muted white (`rgba(255,255,255,0.3)`).

Example dial drawing helper (adapt as needed):

```typescript
function drawDial(
  ctx: CanvasRenderingContext2D,
  x: number,        // left edge of dial strip (canvas px)
  y: number,        // top edge
  width: number,
  height: number,
  labels: string[],
  selectedIndex: number,
  active: boolean   // false if hand not present → dim everything
) {
  const itemH = height / labels.length;
  labels.forEach((label, i) => {
    const isSelected = i === selectedIndex;
    const cy = y + i * itemH + itemH / 2;

    // Selection highlight
    if (isSelected && active) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(x, y + i * itemH, width, itemH);
    }

    ctx.font = isSelected && active ? 'bold 16px monospace' : '14px monospace';
    ctx.fillStyle = isSelected && active ? '#F59E0B' : 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, cy);
  });

  // Dial label
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText(x < ctx.canvas.width / 2 ? 'NOTE' : 'CHORD', x + width / 2, y - 14);
}
```

### Orbs

Keep the existing orb drawing logic. For each hand in `signals` that is present, draw an orb at `(signal.x * w, signal.y * h)`. The orb colors can differ by hand:

- Left hand orb: cool blue (`rgba(100, 180, 255, 0.9)`) 
- Right hand orb: warm amber (`rgba(255, 200, 80, 0.9)`) — same as before

### Mouse Fallback

Task A emits a single signal with `handId: 'left'` in mouse mode. In that case only the note dial will be active (left side), which is fine — just render with whatever signals are present.

---

## Full draw() Structure

```typescript
function draw() {
  const w = canvas.width;
  const h = canvas.height;
  const signals = signalsRef.current ?? [];
  const left  = signals.find(s => s.handId === 'left');
  const right = signals.find(s => s.handId === 'right');

  const DIAL_W = w * 0.15;

  // 1. Clear + background (keep existing code)
  // 2. Warm zone gradient (keep existing code)

  // 3. Left dial — note selection
  const noteIdx = left ? pickIndex(left.x, NOTES.length) : 0;
  drawDial(ctx, 0, 40, DIAL_W, h - 80, NOTES, noteIdx, !!left?.present);

  // 4. Right dial — chord quality selection
  const qualIdx = right ? pickIndex(right.x, QUALITIES.length) : 0;
  drawDial(ctx, w - DIAL_W, 40, DIAL_W, h - 80, QUALITIES, qualIdx, !!right?.present);

  // 5. Orbs for each present hand
  for (const signal of signals) {
    if (!signal.present) continue;
    drawOrb(ctx, signal, w, h, amplitude);
  }

  rafId = requestAnimationFrame(draw);
}
```

---

## Done When

- [ ] Renderer signature accepts `RefObject<GestureSignal[]>`
- [ ] Two dials drawn on left and right edges of canvas
- [ ] Active item highlighted in amber, inactive items dimmed
- [ ] Left hand drives note dial, right hand drives chord dial
- [ ] Both hands show separate orbs in center canvas
- [ ] Works when only one hand is present (or none)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)

---

## Notes

- Do not run `npm install` — all dependencies are already present
- The project uses Vite + React + TypeScript. Run `npm run dev` to test locally.
- `src/engine/types.ts` will be updated by Task A. If you need to start before Task A is done, copy the updated type definitions from the "Updated Types" section above directly into `src/engine/types.ts` as a stub — Task A will reconcile.
