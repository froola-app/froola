# Task A — Input Layer + Coordinator (Two-Hand Control)

## Who This Is For
**Dennis (you).** Your coworker is separately implementing the visual dial renderer (Task B).  
Do NOT touch `src/engine/renderer/index.ts` — that's Task B.

---

## Project Overview

Froola is a gesture-controlled music instrument. Users move their hands in front of a camera and MediaPipe tracks them. Right now only one hand is tracked (`numHands: 1`), producing a single `GestureSignal` that drives an orb on canvas.

We are adding **two-hand control**:
- **Left hand** → selects the **root note** (A, B, C, D, E, F, G)
- **Right hand** → selects the **chord quality** (major, minor, maj7, min7, dom7, aug, dim)

---

## Files You Own

```
src/engine/types.ts          ← shared contract, update this first
src/engine/input/index.ts    ← MediaPipe config + signal emission
src/coordinator.ts           ← maps 2 signals → MusicalCommand
```

---

## Step 1 — Update Types (`src/engine/types.ts`)

Make these changes:

```typescript
// Change handId to be explicit about which hand
export type GestureSignal = {
  x: number;        // 0–1, horizontal position
  y: number;        // 0–1, vertical position
  present: boolean;
  handId: 'left' | 'right';   // was: 'primary' | 'secondary'
};

// Add these new types
export type NoteName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type ChordQuality = 'major' | 'minor' | 'maj7' | 'min7' | 'dom7' | 'aug' | 'dim';

// Extend MusicalCommand to include the selected note + quality
export type MusicalCommand = {
  chord: string;
  voicing: number[];
  register: number;
  texture: number;
  tension: number;
  rootNote: NoteName;       // NEW — selected by left hand
  chordQuality: ChordQuality; // NEW — selected by right hand
};
```

---

## Step 2 — Update Input Hook (`src/engine/input/index.ts`)

Key changes:
1. `numHands: 1` → `numHands: 2`
2. `signalRef` type: `RefObject<GestureSignal>` → `RefObject<GestureSignal[]>`
3. For each detected hand, read `handedness` from MediaPipe result to get `'Left'` or `'Right'`, map to `'left' | 'right'` on `GestureSignal`
4. Mouse fallback: emit a single `[{ handId: 'left', ... }]` entry driven by mouse position (left half of screen = note selection proxy)

### MediaPipe handedness note
`result.handednesses[i][0].categoryName` is `"Left"` or `"Right"` — but because the camera image is mirrored, MediaPipe's "Left" is the user's right hand and vice versa. Flip it:

```typescript
const rawHandedness = result.handednesses[i][0].categoryName; // 'Left' | 'Right'
const handId: 'left' | 'right' = rawHandedness === 'Left' ? 'right' : 'left';
```

### Signal shape after change

```typescript
// Before
const signalRef = useRef<GestureSignal>({ x: 0.5, y: 0.5, present: false, handId: 'primary' });

// After
const signalRef = useRef<GestureSignal[]>([]);

// In the detect loop, rebuild the array each frame:
const signals: GestureSignal[] = [];
for (let i = 0; i < result.landmarks.length; i++) {
  const wrist = result.landmarks[i][0];
  const rawHandedness = result.handednesses[i][0].categoryName;
  const handId: 'left' | 'right' = rawHandedness === 'Left' ? 'right' : 'left';
  signals.push({ x: 1 - wrist.x, y: wrist.y, present: true, handId });
}
signalRef.current = signals;
```

### Return type change

```typescript
// Before
{ signalRef: React.RefObject<GestureSignal>; mode: InputMode; requestCamera: () => void; useMouse: () => void }

// After
{ signalRef: React.RefObject<GestureSignal[]>; mode: InputMode; requestCamera: () => void; useMouse: () => void }
```

---

## Step 3 — Update Coordinator (`src/coordinator.ts`)

Add mapping functions and update the coordinator to use both signals.

### Mapping helpers (add near top of file)

```typescript
const NOTES: NoteName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

function pickFromList<T>(x: number, list: T[]): T {
  const i = Math.min(Math.floor(x * list.length), list.length - 1);
  return list[i];
}
```

### Updated `mapGesture` stub

```typescript
const mapGesture = (signals: GestureSignal[], _vibe: string): MusicalCommand => {
  const left  = signals.find(s => s.handId === 'left');
  const right = signals.find(s => s.handId === 'right');

  const rootNote    = left  ? pickFromList(left.x,  NOTES)    : 'C' as NoteName;
  const chordQuality = right ? pickFromList(right.x, QUALITIES) : 'major' as ChordQuality;

  return {
    chord: `${rootNote}${chordQuality}`,
    voicing: [60, 64, 67],   // stub — Track A will fill this in
    register: right ? right.y : 0.5,
    texture: left  ? left.y  : 0.5,
    tension: 0.2,
    rootNote,
    chordQuality,
  };
};
```

### Update coordinator body

```typescript
export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const { signalRef: inputSignalRef, mode, requestCamera, useMouse } = useGestureInput();
  // ...

  // Fire audio on any hand present
  useEffect(() => {
    const signals = inputSignalRef.current;
    if (!signals.some(s => s.present)) return;
    const cmd = mapGesture(signals, 'default');
    play(cmd);
  });

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, inputSignalRef, analyserRef);

  return { mode, requestCamera, useMouse };
}
```

Note: `useRenderer` now receives `inputSignalRef` typed as `RefObject<GestureSignal[]>` — your coworker's Task B will update the renderer signature to match.

---

## Interface Contract for Task B (renderer)

Your coworker's renderer will receive:

```typescript
useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,   // ← was single GestureSignal
  analyserRef: RefObject<AnalyserNode | null>
)
```

They will read `signalsRef.current` each frame and render two dials.  
**Do not change the renderer signature beyond this** — just update the types.

---

## Done When

- [ ] `GestureSignal[]` flows from input hook through coordinator to renderer call
- [ ] MediaPipe configured with `numHands: 2`
- [ ] Left/right handedness correctly resolved (with mirror flip)
- [ ] Mouse fallback still works (emits at least one signal)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
