# Beginner Tutorial & Hand Guardrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent hand-position guardrail to the canvas and a skippable 4-step interactive tutorial overlay that teaches absolute beginners how the wheels work.

**Architecture:** `drawGuardrail` is a pure canvas function called by the existing renderer each frame when no hands are detected and the guardrail is enabled (ref-controlled, no React re-renders). `BeginnerTutorial` is a React overlay on PlayShell that polls `signalRef` every 100 ms to detect gesture completion for each step.

**Tech Stack:** React 19, TypeScript, Canvas2D, Vitest/jsdom, existing `wheelGeometry` + `useRenderer` + `useCoordinator` patterns.

## Global Constraints

- All high-frequency updates use mutable refs — never React state
- `wheelGeometry(w, h)` is the single source of truth for wheel positions — do not hardcode coordinates
- localStorage keys: `froola.tutorialSeen` (tutorial), `froola.guardrail` (toggle, default `'true'`)
- No emojis in UI text
- CSS goes in `src/App.css`, follow the existing pill-button / dark-overlay pattern
- Run `npm test` after each task and ensure 0 failures before committing
- Run `npm run build` before each commit — zero type errors required

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/engine/renderer/guardrail.ts` | Create | Pure fn that draws pulsing dashed rings at wheel positions |
| `src/engine/renderer/guardrail.test.ts` | Create | Unit tests for drawGuardrail |
| `src/engine/renderer/index.ts` | Modify | Accept `guardrailRef?`, call drawGuardrail when no hands and ref is true |
| `src/coordinator.ts` | Modify | Accept `guardrailRef?` as 10th param, forward to useRenderer |
| `src/components/PlayShell.tsx` | Modify | Create guardrailRef + toggle button; mount BeginnerTutorial; pass signalRef |
| `src/components/learn/LearnShell.tsx` | Modify | Create guardrailRef from localStorage, pass to useCoordinator |
| `src/components/BeginnerTutorial.tsx` | Create | 4-step gesture-driven tutorial overlay |
| `src/components/BeginnerTutorial.test.tsx` | Create | Unit tests for step advancement and skip logic |
| `src/App.css` | Modify | Add tutorial overlay styles and guardrail toggle button style |

---

## Task 1: `drawGuardrail` pure function

**Files:**
- Create: `src/engine/renderer/guardrail.ts`
- Create: `src/engine/renderer/guardrail.test.ts`

**Interfaces:**
- Produces: `drawGuardrail(ctx, w, h, now): void` — used by Task 2

- [ ] **Step 1: Write the failing tests**

```typescript
// src/engine/renderer/guardrail.test.ts
import { describe, it, expect, vi } from 'vitest';
import { drawGuardrail } from './guardrail';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '' as string,
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('drawGuardrail', () => {
  it('draws exactly two arcs (one per wheel)', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('calls save and restore to isolate drawing state', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('uses a dashed line style', () => {
    const ctx = makeCtx();
    drawGuardrail(ctx, 1280, 720, 0);
    expect(ctx.setLineDash).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- --reporter=verbose guardrail
```

Expected: 3 failures — `drawGuardrail` not defined.

- [ ] **Step 3: Implement `drawGuardrail`**

```typescript
// src/engine/renderer/guardrail.ts
import { wheelGeometry } from './geometry';

export function drawGuardrail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
): void {
  const { outerR, leftCx, rightCx, cy } = wheelGeometry(w, h);
  const alpha = 0.12 + 0.08 * Math.sin(now / 600);

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);

  ctx.beginPath();
  ctx.arc(leftCx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(rightCx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- --reporter=verbose guardrail
```

Expected: 3 passing.

- [ ] **Step 5: Full suite passes**

```bash
npm test
```

Expected: 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderer/guardrail.ts src/engine/renderer/guardrail.test.ts
git commit -m "feat: add drawGuardrail canvas function"
```

---

## Task 2: Wire guardrail through renderer → coordinator → shells

**Files:**
- Modify: `src/engine/renderer/index.ts`
- Modify: `src/coordinator.ts`
- Modify: `src/components/PlayShell.tsx`
- Modify: `src/components/learn/LearnShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `drawGuardrail(ctx, w, h, now)` from Task 1
- Produces:
  - `useRenderer(..., guardrailRef?: RefObject<boolean>): void` — 9th param
  - `useCoordinator(..., guardrailRef?: RefObject<boolean>)` — 10th param

- [ ] **Step 1: Add `guardrailRef` to `useRenderer`**

In `src/engine/renderer/index.ts`, update the function signature (current 8th param is `stickyExtensionRef`):

```typescript
// Add this import at the top of the file
import { drawGuardrail } from './guardrail';

// Update useRenderer signature — add guardrailRef as 9th param:
export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,
  analyserRef: RefObject<AnalyserNode | null>,
  selectedRef: RefObject<DialSelection>,
  commandRef?: RefObject<MusicalCommand | null>,
  musicRef?: RefObject<MusicConfig>,
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  stickyExtensionRef?: RefObject<boolean>,
  guardrailRef?: RefObject<boolean>,
): void {
```

Inside the `draw()` function, add the guardrail call immediately after `ctx.clearRect(0, 0, w, h)`:

```typescript
      // Clear only — let the raw camera feed show through with no tint
      ctx.clearRect(0, 0, w, h);

      // Guardrail: pulsing ring guides shown when no hands are in frame.
      // Disappears the moment any hand is detected.
      const handsPresent = signals.some(s => s.present);
      if (!handsPresent && (guardrailRef?.current ?? true)) {
        drawGuardrail(ctx, w, h, performance.now());
      }
```

Add `guardrailRef` to the `useEffect` dependency array at the bottom of `useRenderer`:

```typescript
  }, [canvasRef, signalsRef, analyserRef, commandRef, ghostSignalsRef, stickyExtensionRef, guardrailRef]);
```

- [ ] **Step 2: Add `guardrailRef` to `useCoordinator`**

In `src/coordinator.ts`, add the 10th parameter (after `loopPlayingRef`):

```typescript
export function useCoordinator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modeRef: RefObject<InstrumentMode>,
  initialMode: InputMode = 'asking',
  octaveRef?: RefObject<number>,
  externalSignalRef?: RefObject<GestureSignal[]>,
  musicRef?: RefObject<MusicConfig>,
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  onVolumeChange?: (v: number) => void,
  loopPlayingRef?: RefObject<boolean>,
  guardrailRef?: RefObject<boolean>,
) {
```

Pass it to `useRenderer` (currently called at line ~233 with 8 args — add as 9th):

```typescript
  useRenderer(
    canvasRef as RefObject<HTMLCanvasElement>,
    signalRef as RefObject<GestureSignal[]>,
    analyserRef,
    selectedRef,
    undefined,
    musicRef,
    ghostSignalsRef,
    stickyExtensionRef,
    guardrailRef,
  );
```

- [ ] **Step 3: Wire guardrail in `PlayShell`**

In `src/components/PlayShell.tsx`, add guardrail state and ref after the existing `volumeTimerRef`:

```typescript
  const [guardrailOn, setGuardrailOn] = useState(() => {
    try { return localStorage.getItem('froola.guardrail') !== 'false'; } catch { return true; }
  });
  const guardrailRef = useRef(guardrailOn);
  guardrailRef.current = guardrailOn;

  function toggleGuardrail() {
    const next = !guardrailOn;
    setGuardrailOn(next);
    try { localStorage.setItem('froola.guardrail', String(next)); } catch {}
  }
```

Update the `useCoordinator` call to pass `guardrailRef` as the 10th argument (after `loopPlayingRef` if present, or after `handleVolumeChange`). Count the existing arguments carefully and append:

```typescript
  const { mode, requestCamera, useMouse, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef, signalRef } = useCoordinator(
    canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, handleVolumeChange, loopPlayingRef, guardrailRef
  );
```

> **Note:** `signalRef` is already returned by `useCoordinator` (see coordinator.ts return block) — add it to the destructured object here so BeginnerTutorial can receive it in Task 3.

Add a guardrail toggle button inside `.hud-bottom` in the JSX, after the octave control:

```tsx
        <button
          className="guardrail-toggle"
          onClick={toggleGuardrail}
          aria-label={guardrailOn ? 'Hide hand guides' : 'Show hand guides'}
          title={guardrailOn ? 'Hide hand guides' : 'Show hand guides'}
        >
          {guardrailOn ? 'guide: on' : 'guide: off'}
        </button>
```

- [ ] **Step 4: Wire guardrail in `LearnShell`**

In `src/components/learn/LearnShell.tsx`, add a `guardrailRef` near the top of the component (after existing refs):

```typescript
  const guardrailRef = useRef<boolean>(
    (() => { try { return localStorage.getItem('froola.guardrail') !== 'false'; } catch { return true; } })()
  );
```

Pass it as 10th arg to `useCoordinator`:

```typescript
  const { ... } = useCoordinator(
    canvasRef, modeRef, INITIAL_INPUT, undefined, undefined, undefined, ghostSignalsRef,
    undefined, undefined, guardrailRef
  );
```

- [ ] **Step 5: Add CSS for the toggle button**

In `src/App.css`, add after the `.octave-btn` block (search for `.octave-btn` to find the right place):

```css
.guardrail-toggle {
  font-family: monospace;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(17, 17, 17, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 0.4rem 1.1rem;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.guardrail-toggle:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.45);
}
```

- [ ] **Step 6: Build and test**

```bash
npm run build
npm test
```

Expected: clean build, 0 test failures.

- [ ] **Step 7: Manual smoke test**

Start the dev server (`npm run dev`). Open the app in camera mode. Confirm:
- Pulsing dashed rings appear on both wheels when no hands are visible
- Rings disappear immediately when a hand enters the frame
- "guide: on" / "guide: off" toggle button appears in the bottom HUD
- Toggling hides/shows the rings; preference survives a page refresh
- Lesson view also shows the guardrail rings (navigate to a lesson)

- [ ] **Step 8: Commit**

```bash
git add src/engine/renderer/index.ts src/coordinator.ts src/components/PlayShell.tsx src/components/learn/LearnShell.tsx src/App.css
git commit -m "feat: add hand guardrail to renderer with toggle"
```

---

## Task 3: `BeginnerTutorial` component

**Files:**
- Create: `src/components/BeginnerTutorial.tsx`
- Create: `src/components/BeginnerTutorial.test.tsx`
- Modify: `src/components/PlayShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes:
  - `signalRef: RefObject<GestureSignal[]>` — from coordinator (Task 2)
  - `selectedRef: RefObject<DialSelection>` — from coordinator (already destructured)
  - `mode: InputMode` — from coordinator
  - `wheelGeometry(w, h): WheelGeometry` — from `src/engine/renderer/geometry`
- Produces: `<BeginnerTutorial signalRef selectedRef mode />` — mounted in PlayShell

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/BeginnerTutorial.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import BeginnerTutorial from './BeginnerTutorial';
import type { GestureSignal } from '../engine/types';
import type { DialSelection } from '../engine/renderer';

// jsdom has no real layout so wheelGeometry returns zeroes — mock it
vi.mock('../engine/renderer/geometry', () => ({
  wheelGeometry: () => ({ outerR: 100, innerR: 36, leftCx: 150, rightCx: 850, cy: 468 }),
}));

function makeSignalRef(signals: GestureSignal[] = []) {
  const ref = { current: signals };
  return ref as React.RefObject<GestureSignal[]>;
}
function makeSelectedRef(noteIdx = 0) {
  return { current: { noteIdx, qualIdx: 0 } } as React.RefObject<DialSelection>;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BeginnerTutorial', () => {
  it('shows step 1 headline on first render in camera mode', () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();
  });

  it('shows step 2 in mouse mode (skips camera step)', () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="mouse"
      />
    );
    expect(screen.getByText('Touch the left circle')).toBeDefined();
  });

  it('advances from step 1 when a hand signal is present', async () => {
    const signalRef = makeSignalRef([]);
    render(
      <BeginnerTutorial
        signalRef={signalRef}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();

    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];
    await act(async () => { vi.advanceTimersByTime(150); });

    expect(screen.getByText('Touch the left circle')).toBeDefined();
  });

  it('sets localStorage flag and unmounts when skip is clicked', async () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    screen.getByText('Skip tutorial').click();
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(screen.queryByText('Hold your hands up')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- --reporter=verbose BeginnerTutorial
```

Expected: 4 failures — `BeginnerTutorial` not found.

- [ ] **Step 3: Implement `BeginnerTutorial`**

```typescript
// src/components/BeginnerTutorial.tsx
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import type { DialSelection } from '../engine/renderer';
import type { InputMode } from '../engine/input';
import { wheelGeometry } from '../engine/renderer/geometry';

const TUTORIAL_KEY = 'froola.tutorialSeen';

const STEPS = [
  {
    headline: 'Hold your hands up',
    body: 'Lift both hands in front of your camera so Froola can see them.',
  },
  {
    headline: 'Touch the left circle',
    body: 'Move your left hand onto the big circle on the left — you should hear a chord.',
  },
  {
    headline: 'Slide around to change the chord',
    body: 'Keep your hand on the circle and move it around — the music changes as you go.',
  },
  {
    headline: 'Try the right circle',
    body: 'Put your right hand on the right circle to change the flavor of the chord.',
  },
] as const;

interface Props {
  signalRef: RefObject<GestureSignal[]>;
  selectedRef: RefObject<DialSelection>;
  mode: InputMode;
}

export default function BeginnerTutorial({ signalRef, selectedRef, mode }: Props) {
  const initialStep = mode === 'mouse' ? 1 : 0;
  const [step, setStep] = useState(initialStep);
  const [doneMessage, setDoneMessage] = useState(false);
  const [gone, setGone] = useState(false);
  const visitedRef = useRef(new Set<number>());

  useEffect(() => {
    if (doneMessage || gone || step >= STEPS.length) return;

    const id = setInterval(() => {
      const signals = signalRef.current;
      const { outerR, innerR, leftCx, rightCx, cy } = wheelGeometry(
        window.innerWidth,
        window.innerHeight,
      );

      const inRing = (x: number, y: number, cx: number) => {
        const d = Math.hypot(x * window.innerWidth - cx, y * window.innerHeight - cy);
        return d >= innerR && d <= outerR;
      };

      const left = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      let advance = false;
      if (step === 0) {
        advance = signals.length > 0;
      } else if (step === 1) {
        advance = !!left?.present && inRing(left.x, left.y, leftCx);
      } else if (step === 2) {
        if (left?.present && inRing(left.x, left.y, leftCx)) {
          visitedRef.current.add(selectedRef.current.noteIdx);
        }
        advance = visitedRef.current.size >= 3;
      } else if (step === 3) {
        advance = !!right?.present && inRing(right.x, right.y, rightCx);
      }

      if (advance) {
        const next = step + 1;
        if (next >= STEPS.length) {
          localStorage.setItem(TUTORIAL_KEY, 'true');
          setDoneMessage(true);
          setTimeout(() => setGone(true), 1500);
        } else {
          setStep(next);
        }
      }
    }, 100);

    return () => clearInterval(id);
  }, [step, doneMessage, gone]);

  function skip() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setGone(true);
  }

  if (gone) return null;

  if (doneMessage) {
    return (
      <div className="tutorial-overlay">
        <div className="tutorial-card">
          <h2 className="tutorial-headline">You're ready — have fun!</h2>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  return (
    <div className="tutorial-overlay">
      <button className="tutorial-skip" onClick={skip}>Skip tutorial</button>
      <div className="tutorial-card">
        <p className="tutorial-step-count">{step + 1} / {STEPS.length}</p>
        <h2 className="tutorial-headline">{current.headline}</h2>
        <p className="tutorial-body">{current.body}</p>
        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === step ? ' tutorial-dot--active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- --reporter=verbose BeginnerTutorial
```

Expected: 4 passing.

- [ ] **Step 5: Full suite passes**

```bash
npm test
```

Expected: 0 failures.

- [ ] **Step 6: Add CSS for the tutorial overlay**

In `src/App.css`, append at the end of the file:

```css
/* ── Beginner Tutorial Overlay ─────────────────────────────────── */

.tutorial-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.60);
  font-family: 'DM Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.tutorial-skip {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
}
.tutorial-skip:hover { color: #fff; }

.tutorial-card {
  background: rgba(17, 17, 17, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1.25rem;
  padding: 2.5rem 2rem;
  max-width: 420px;
  width: calc(100vw - 3rem);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tutorial-step-count {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.tutorial-headline {
  font-size: clamp(1.4rem, 4vw, 1.9rem);
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0;
}

.tutorial-body {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  margin: 0;
}

.tutorial-dots {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tutorial-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.tutorial-dot--active {
  background: #f59e0b;
}
```

- [ ] **Step 7: Mount `BeginnerTutorial` in `PlayShell`**

In `src/components/PlayShell.tsx`, add the import at the top:

```typescript
import BeginnerTutorial from './BeginnerTutorial';
```

Add a `showTutorial` constant after the existing state declarations:

```typescript
  const [showTutorial] = useState(
    () => !localStorage.getItem('froola.tutorialSeen')
  );
```

In the JSX return, add `BeginnerTutorial` after the `<canvas>` tag (so it renders above the canvas but below the permission screen):

```tsx
      <canvas ref={canvasRef} className="main-canvas" />
      {showTutorial && mode !== 'asking' && (
        <BeginnerTutorial
          signalRef={signalRef}
          selectedRef={selectedRef}
          mode={mode}
        />
      )}
      {volumeDisplay !== null && (
        <div className="volume-badge">vol {volumeDisplay}%</div>
      )}
```

- [ ] **Step 8: Build**

```bash
npm run build
```

Expected: clean build with zero type errors. If TypeScript complains that `signalRef` isn't in the coordinator's return type, open `src/coordinator.ts` and confirm `signalRef` is in the `return` block (it should be — it was added earlier). If not, add it.

- [ ] **Step 9: Full test suite**

```bash
npm test
```

Expected: 0 failures.

- [ ] **Step 10: Manual smoke test**

Start dev server (`npm run dev`). In a private/incognito window (clean localStorage):

1. Open the app and grant camera access
2. Confirm tutorial overlay appears with "Hold your hands up" (step 1)
3. Raise a hand into frame — confirm it advances to "Touch the left circle"
4. Move hand onto the left wheel — confirm it advances to "Slide around"
5. Move hand around the left wheel to 3+ positions — confirm "Try the right circle"
6. Put right hand on right wheel — confirm "You're ready — have fun!" appears for ~1.5s then overlay disappears
7. Refresh page — tutorial does NOT reappear (localStorage flag set)
8. In a second private window, click "Skip tutorial" — tutorial dismisses, flag is set

Also confirm in mouse mode:
- Tutorial starts at "Touch the left circle" (camera step skipped)

Also confirm guardrail:
- Without hands: pulsing dashed rings visible
- With hands: rings vanish immediately

- [ ] **Step 11: Commit**

```bash
git add src/components/BeginnerTutorial.tsx src/components/BeginnerTutorial.test.tsx src/components/PlayShell.tsx src/App.css
git commit -m "feat: add 4-step beginner tutorial overlay"
```
