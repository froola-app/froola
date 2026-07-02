# SP4 — Session Recording & Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players record up to 30s of play, encode it into a shareable URL, and replay it on a dedicated `/replay` page.

**Architecture:** A `codec.ts` module packs samples into binary (5 bytes each) and encodes as base64url. A `useRecorder` hook samples gesture signals at 10Hz and builds the recording. `RecordButton` owns the record/stop/share UI. `ReplayShell` decodes the URL param, schedules audio playback via `setTimeout` chain, and drives the existing renderer in watch mode.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Canvas2D, Web Audio API (via SP2's AudioEngine).

## Global Constraints

- 30-second hard cap on recordings
- 10 samples/sec (one sample every 100ms via `setInterval`)
- 5 bytes per sample: `dt` (uint16 big-endian), `noteIdx` (uint8 0–6), `qualityIdx` (uint8 0–6), `vibe` (uint8 0–3)
- base64url encoding: replace `+→-`, `/→_`, strip `=` padding
- Tasks 1–4 are SP2-independent. Task 5 (ReplayShell audio) requires SP2 Track A merged (AudioEngine class with `play()`, `resume()`, `setVibe()`)
- `npm run build` zero TypeScript errors after every task
- `npm test` all pass after every task
- One focused commit per task

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/engine/types.ts` | Modify | Add `RecordingSample`, `Recording` types |
| `src/engine/recording/codec.ts` | Create | `encode(Recording): string` and `decode(string): Recording` |
| `src/engine/recording/codec.test.ts` | Create | Round-trip and error tests |
| `src/engine/recording/useRecorder.ts` | Create | Hook: sampling loop, state machine, shareUrl generation |
| `src/engine/recording/useRecorder.test.ts` | Create | State transition tests |
| `src/components/RecordButton.tsx` | Create | Record/Stop/Share pill + progress bar |
| `src/components/RecordButton.test.tsx` | Create | UI state tests |
| `src/components/ReplayShell.tsx` | Create | `/replay` page: decode, schedule playback, renderer |
| `src/components/PlayShell.tsx` | Modify | Mount `<RecordButton>` |
| `src/App.tsx` | Modify | Add `/replay` route |
| `src/App.css` | Modify | `.record-btn`, `.record-progress`, `.replay-badge`, `.replay-end` |

---

### Task 1: Add RecordingSample and Recording types

**Files:**
- Modify: `src/engine/types.ts`

**Interfaces:**
- Produces:
  ```typescript
  type RecordingSample = { dt: number; noteIdx: number; qualityIdx: number; vibe: number; }
  type Recording = { samples: RecordingSample[]; totalMs: number; }
  ```

- [ ] **Step 1: Add types to `src/engine/types.ts`**

Open `src/engine/types.ts` and append at the bottom:

```typescript
/** One recorded gesture sample. 5 bytes when packed by codec. */
export type RecordingSample = {
  dt: number;         // ms since previous sample (uint16)
  noteIdx: number;    // 0–6, index into NOTES array
  qualityIdx: number; // 0–6, index into QUALITIES array
  vibe: number;       // 0–3, index into VIBES array
};

export type Recording = {
  samples: RecordingSample[];
  totalMs: number;    // sum of all dt values
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add RecordingSample and Recording types"
```

---

### Task 2: Codec — encode and decode

**Files:**
- Create: `src/engine/recording/codec.ts`
- Create: `src/engine/recording/codec.test.ts`

**Interfaces:**
- Consumes: `Recording`, `RecordingSample` from `../../engine/types`
- Produces:
  ```typescript
  export function encode(recording: Recording): string  // → base64url
  export function decode(data: string): Recording       // throws on malformed input
  ```

- [ ] **Step 1: Write failing tests**

Create `src/engine/recording/codec.test.ts`:

```typescript
import { encode, decode } from './codec';
import type { Recording } from '../types';

const sample = { dt: 100, noteIdx: 3, qualityIdx: 1, vibe: 0 };
const recording: Recording = { samples: [sample], totalMs: 100 };

describe('codec', () => {
  it('encode produces a non-empty string', () => {
    expect(encode(recording)).toBeTruthy();
  });

  it('round-trips a single sample', () => {
    const decoded = decode(encode(recording));
    expect(decoded.samples).toHaveLength(1);
    expect(decoded.samples[0]).toEqual(sample);
    expect(decoded.totalMs).toBe(100);
  });

  it('round-trips multiple samples', () => {
    const multi: Recording = {
      samples: [
        { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 },
        { dt: 150, noteIdx: 6, qualityIdx: 6, vibe: 3 },
        { dt: 200, noteIdx: 3, qualityIdx: 3, vibe: 2 },
      ],
      totalMs: 450,
    };
    const decoded = decode(encode(multi));
    expect(decoded.samples).toEqual(multi.samples);
    expect(decoded.totalMs).toBe(450);
  });

  it('produces base64url (no +, /, or = characters)', () => {
    const encoded = encode(recording);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('decode throws on wrong length', () => {
    expect(() => decode('YWJj')).toThrow('Invalid recording data');
  });

  it('decode throws on invalid noteIdx', () => {
    // Build a valid buffer then corrupt noteIdx to 255
    const buf = new Uint8Array(5);
    new DataView(buf.buffer).setUint16(0, 100, false);
    buf[2] = 255; buf[3] = 0; buf[4] = 0;
    const bad = btoa(String.fromCharCode(...buf))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(() => decode(bad)).toThrow('Invalid recording data');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep "codec"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement codec**

Create `src/engine/recording/codec.ts`:

```typescript
import type { Recording, RecordingSample } from '../types';

export function encode(recording: Recording): string {
  const buf = new Uint8Array(recording.samples.length * 5);
  const view = new DataView(buf.buffer);
  recording.samples.forEach((s, i) => {
    view.setUint16(i * 5, s.dt, false);
    buf[i * 5 + 2] = s.noteIdx;
    buf[i * 5 + 3] = s.qualityIdx;
    buf[i * 5 + 4] = s.vibe;
  });
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decode(data: string): Recording {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  if (buf.length === 0 || buf.length % 5 !== 0) {
    throw new Error('Invalid recording data');
  }

  const view = new DataView(buf.buffer);
  const samples: RecordingSample[] = [];
  let totalMs = 0;

  for (let i = 0; i < buf.length; i += 5) {
    const dt = view.getUint16(i, false);
    const noteIdx = buf[i + 2];
    const qualityIdx = buf[i + 3];
    const vibe = buf[i + 4];

    if (noteIdx > 6 || qualityIdx > 6 || vibe > 3) {
      throw new Error('Invalid recording data');
    }

    samples.push({ dt, noteIdx, qualityIdx, vibe });
    totalMs += dt;
  }

  return { samples, totalMs };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/recording/codec.ts src/engine/recording/codec.test.ts
git commit -m "feat: add recording codec (encode/decode base64url)"
```

---

### Task 3: useRecorder hook

**Files:**
- Create: `src/engine/recording/useRecorder.ts`
- Create: `src/engine/recording/useRecorder.test.ts`

**Interfaces:**
- Consumes:
  - `encode(recording: Recording): string` from `./codec`
  - `GestureSignal`, `RecordingSample`, `Recording` from `../types`
- Produces:
  ```typescript
  export type RecorderState = 'idle' | 'recording' | 'done';
  export function useRecorder(
    signalsRef: RefObject<GestureSignal[]>,
    vibe: string   // Vibe type from SP2; use string until SP2 merges
  ): {
    state: RecorderState;
    elapsed: number;        // seconds 0–30
    shareUrl: string | null;
    start: () => void;
    stop: () => void;
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `src/engine/recording/useRecorder.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../types';
import { useRecorder } from './useRecorder';

function makeRef(signals: GestureSignal[] = []): RefObject<GestureSignal[]> {
  return { current: signals };
}

describe('useRecorder', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsed).toBe(0);
    expect(result.current.shareUrl).toBeNull();
  });

  it('transitions to recording on start()', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
  });

  it('transitions to done on stop() and sets shareUrl', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.shareUrl).toMatch(/\/replay\?d=/);
  });

  it('shareUrl contains a non-empty base64url payload', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    const url = result.current.shareUrl!;
    const d = new URL(url).searchParams.get('d');
    expect(d).toBeTruthy();
  });

  it('can start again after done', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
    expect(result.current.shareUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useRecorder**

Create `src/engine/recording/useRecorder.ts`:

```typescript
import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, RecordingSample, Recording } from '../types';
import { encode } from './codec';

const NOTES_LEN = 7;
const QUALITIES_LEN = 7;
const VIBES = ['warm', 'bright', 'dark', 'electric'];
const MAX_DURATION_MS = 30_000;
const INTERVAL_MS = 100;

function pickIndex(x: number, count: number): number {
  return Math.min(Math.floor(x * count), count - 1);
}

export type RecorderState = 'idle' | 'recording' | 'done';

export function useRecorder(
  signalsRef: RefObject<GestureSignal[]>,
  vibe: string
) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const samplesRef = useRef<RecordingSample[]>([]);
  const startTimeRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibeRef = useRef(vibe);

  useEffect(() => { vibeRef.current = vibe; }, [vibe]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const recording: Recording = {
      samples: samplesRef.current,
      totalMs: samplesRef.current.reduce((s, r) => s + r.dt, 0),
    };
    const encoded = encode(recording);
    setShareUrl(window.location.origin + '/replay?d=' + encoded);
    setState('done');
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    samplesRef.current = [];
    const now = performance.now();
    startTimeRef.current = now;
    lastSampleTimeRef.current = now;
    setElapsed(0);
    setShareUrl(null);
    setState('recording');

    intervalRef.current = setInterval(() => {
      const tick = performance.now();
      const totalElapsed = tick - startTimeRef.current;
      setElapsed(Math.min(totalElapsed / 1000, 30));

      const dt = Math.round(tick - lastSampleTimeRef.current);
      lastSampleTimeRef.current = tick;

      const signals = signalsRef.current ?? [];
      const left = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');
      const vibeIdx = Math.max(0, VIBES.indexOf(vibeRef.current));

      samplesRef.current.push({
        dt,
        noteIdx: left ? pickIndex(left.x, NOTES_LEN) : 0,
        qualityIdx: right ? pickIndex(right.x, QUALITIES_LEN) : 0,
        vibe: vibeIdx,
      });

      if (totalElapsed >= MAX_DURATION_MS) stop();
    }, INTERVAL_MS);
  }, [signalsRef, stop]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { state, elapsed, shareUrl, start, stop };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/recording/useRecorder.ts src/engine/recording/useRecorder.test.ts
git commit -m "feat: add useRecorder hook with 10Hz sampling and auto-stop at 30s"
```

---

### Task 4: RecordButton component + styles + mount in PlayShell

**Files:**
- Create: `src/components/RecordButton.tsx`
- Create: `src/components/RecordButton.test.tsx`
- Modify: `src/components/PlayShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes:
  - `useRecorder(signalsRef, vibe)` from `../engine/recording/useRecorder`
  - `GestureSignal` from `../engine/types`
- Produces: `<RecordButton signalsRef={...} vibe={...} />` mountable in PlayShell

- [ ] **Step 1: Write failing tests**

Create `src/components/RecordButton.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import RecordButton from './RecordButton';

function Harness() {
  const signalsRef = useRef([]);
  return <RecordButton signalsRef={signalsRef} vibe="warm" />;
}

describe('RecordButton', () => {
  it('shows Rec in idle state', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /rec/i })).toBeInTheDocument();
  });

  it('shows Stop after clicking Rec', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows Share after clicking Stop', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('copies shareUrl on Share click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/replay\?d=/)
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RecordButton**

Create `src/components/RecordButton.tsx`:

```tsx
import { useState } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import { useRecorder } from '../engine/recording/useRecorder';

type Props = {
  signalsRef: RefObject<GestureSignal[]>;
  vibe: string;
};

export default function RecordButton({ signalsRef, vibe }: Props) {
  const { state, elapsed, shareUrl, start, stop } = useRecorder(signalsRef, vibe);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state === 'idle') {
    return (
      <button className="record-btn record-btn--idle" onClick={start}>
        ● Rec
      </button>
    );
  }

  if (state === 'recording') {
    const pct = Math.min((elapsed / 30) * 100, 100);
    return (
      <>
        <div className="record-progress" style={{ width: `${pct}%` }} />
        <button className="record-btn record-btn--recording" onClick={stop}>
          ■ {Math.floor(elapsed)}s — Stop
        </button>
      </>
    );
  }

  // done
  return (
    <button className="record-btn record-btn--done" onClick={handleShare}>
      {copied ? 'Copied!' : '↗ Share replay'}
    </button>
  );
}
```

- [ ] **Step 4: Add styles**

Append to `src/App.css`:

```css
.record-btn {
  position: fixed;
  bottom: 1.5rem;
  left: 1rem;
  font-family: monospace;
  font-size: 0.85rem;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  z-index: 20;
  border: 1px solid transparent;
}

.record-btn--idle {
  color: rgba(255, 100, 100, 0.7);
  background: rgba(255, 80, 80, 0.08);
  border-color: rgba(255, 80, 80, 0.2);
}

.record-btn--idle:hover {
  background: rgba(255, 80, 80, 0.16);
  color: rgba(255, 100, 100, 1);
}

.record-btn--recording {
  color: #fff;
  background: rgba(220, 38, 38, 0.85);
  border-color: #dc2626;
}

.record-btn--done {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.3);
}

.record-btn--done:hover {
  background: rgba(245, 158, 11, 0.22);
  color: #f59e0b;
}

.record-progress {
  position: fixed;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #dc2626;
  z-index: 30;
  transition: width 0.1s linear;
}
```

- [ ] **Step 5: Mount RecordButton in PlayShell**

Open `src/components/PlayShell.tsx`. Add import:

```tsx
import RecordButton from './RecordButton';
```

Then update the returned JSX — add `<RecordButton>` after `<ShareButton>`. The coordinator currently returns `{ mode, requestCamera, useMouse }` — SP2 will add `vibe`; for now default to `'warm'`:

```tsx
export default function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coordinator = useCoordinator(canvasRef);
  const { mode, requestCamera, useMouse } = coordinator;
  const vibe = (coordinator as Record<string, unknown>).vibe as string ?? 'warm';

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      <ShareButton />
      <RecordButton signalsRef={/* need signalsRef from coordinator */} vibe={vibe} />
    </>
  );
}
```

Wait — `signalsRef` is internal to `useCoordinator` and not currently exposed. We need to expose it. Update `useCoordinator` in `src/coordinator.ts` to return `signalsRef`:

Open `src/coordinator.ts`. Find the return statement:

```typescript
return { mode, requestCamera, useMouse };
```

Replace with:

```typescript
return { mode, requestCamera, useMouse, signalRef: inputSignalRef };
```

Now update `PlayShell.tsx` to use it:

```tsx
import { useRef } from 'react';
import { useCoordinator } from '../coordinator';
import ShareButton from './ShareButton';
import RecordButton from './RecordButton';

function CameraPrompt({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  return (
    <div className="permission-screen">
      <h1>Froola</h1>
      <p className="privacy-note">Your camera never leaves your device.</p>
      <p>MediaPipe runs entirely on your device — no video is transmitted.</p>
      <div className="permission-buttons">
        <button onClick={onCamera} className="btn-primary">Enable camera</button>
        <button onClick={onMouse} className="btn-secondary">Use mouse instead</button>
      </div>
    </div>
  );
}

function MouseModeBadge({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="mode-badge">
      Mouse mode —{' '}
      <button onClick={onSwitch} className="link-btn">try camera mode</button>
    </div>
  );
}

export default function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coordinator = useCoordinator(canvasRef);
  const { mode, requestCamera, useMouse, signalRef } = coordinator;
  const vibe = (coordinator as Record<string, unknown>).vibe as string ?? 'warm';

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      <ShareButton />
      <RecordButton signalsRef={signalRef} vibe={vibe} />
    </>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/RecordButton.tsx src/components/RecordButton.test.tsx src/components/PlayShell.tsx src/coordinator.ts src/App.css
git commit -m "feat: add RecordButton with record/stop/share states"
```

---

### Task 5: ReplayShell component

> **Requires SP2 Track A merged** — needs `AudioEngine` from `src/engine/audio/AudioEngine.ts` with `play(cmd)`, `resume()`, `suspend()`, `setVibe(vibe)`. If SP2 is not merged, skip this task and return to it later.

**Files:**
- Create: `src/components/ReplayShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes:
  - `decode(data: string): Recording` from `../engine/recording/codec`
  - `AudioEngine` from `../engine/audio/AudioEngine` (SP2)
  - `useRenderer` from `../engine/renderer` (existing)
  - `useSearchParams` from `react-router-dom`
  - `MusicalCommand`, `GestureSignal` from `../engine/types`
- Produces: `<ReplayShell />` — full-screen replay page

The quality intervals and tension table used to reconstruct `MusicalCommand` during playback:

```typescript
const NOTES: NoteName[] = ['A','B','C','D','E','F','G'];
const QUALITIES: ChordQuality[] = ['major','minor','maj7','min7','dom7','aug','dim'];
const VIBES = ['warm','bright','dark','electric'] as const;

const QUALITY_DATA: Record<ChordQuality, { intervals: number[]; tension: number }> = {
  major: { intervals: [0, 4, 7],      tension: 0.0 },
  minor: { intervals: [0, 3, 7],      tension: 0.2 },
  maj7:  { intervals: [0, 4, 7, 11],  tension: 0.1 },
  min7:  { intervals: [0, 3, 7, 10],  tension: 0.3 },
  dom7:  { intervals: [0, 4, 7, 10],  tension: 0.5 },
  aug:   { intervals: [0, 4, 8],      tension: 0.7 },
  dim:   { intervals: [0, 3, 6],      tension: 0.9 },
};

const BASE_MIDI = 60; // middle C
```

- [ ] **Step 1: Implement ReplayShell**

Create `src/components/ReplayShell.tsx`:

```tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { decode } from '../engine/recording/codec';
import { AudioEngine } from '../engine/audio/AudioEngine';
import { useRenderer } from '../engine/renderer';
import type { MusicalCommand, GestureSignal, NoteName, ChordQuality } from '../engine/types';
import type { Recording } from '../engine/types';

const NOTES: NoteName[] = ['A','B','C','D','E','F','G'];
const QUALITIES: ChordQuality[] = ['major','minor','maj7','min7','dom7','aug','dim'];
const VIBES = ['warm','bright','dark','electric'] as const;
const BASE_MIDI = 60;

const QUALITY_DATA: Record<ChordQuality, { intervals: number[]; tension: number }> = {
  major: { intervals: [0, 4, 7],      tension: 0.0 },
  minor: { intervals: [0, 3, 7],      tension: 0.2 },
  maj7:  { intervals: [0, 4, 7, 11],  tension: 0.1 },
  min7:  { intervals: [0, 3, 7, 10],  tension: 0.3 },
  dom7:  { intervals: [0, 4, 7, 10],  tension: 0.5 },
  aug:   { intervals: [0, 4, 8],      tension: 0.7 },
  dim:   { intervals: [0, 3, 6],      tension: 0.9 },
};

function buildCommand(noteIdx: number, qualityIdx: number): MusicalCommand {
  const rootNote = NOTES[noteIdx];
  const chordQuality = QUALITIES[qualityIdx];
  const { intervals, tension } = QUALITY_DATA[chordQuality];
  const rootMidi = BASE_MIDI + noteIdx;
  return {
    chord: `${rootNote}${chordQuality}`,
    voicing: intervals.map(i => rootMidi + i),
    register: 0.5,
    texture: 0.5,
    tension,
    rootNote,
    chordQuality,
  };
}

function buildSignals(noteIdx: number, qualityIdx: number): GestureSignal[] {
  return [
    { handId: 'left',  x: (noteIdx + 0.5) / 7,    y: 0.5, present: true },
    { handId: 'right', x: (qualityIdx + 0.5) / 7,  y: 0.5, present: true },
  ];
}

export default function ReplayShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commandRef = useRef<MusicalCommand | null>(null);
  const signalsRef = useRef<GestureSignal[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done' | 'error'>('ready');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [copied, setCopied] = useState(false);

  useRenderer(canvasRef as React.RefObject<HTMLCanvasElement>, signalsRef, analyserRef, commandRef);

  // Decode recording from URL on mount
  useEffect(() => {
    const d = searchParams.get('d');
    if (!d) { setPhase('error'); return; }
    try {
      setRecording(decode(d));
    } catch {
      setPhase('error');
    }
  }, [searchParams]);

  // Init audio engine
  useEffect(() => {
    engineRef.current = new AudioEngine();
    analyserRef.current = engineRef.current.getAnalyser();
    return () => {
      engineRef.current?.suspend();
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const startPlayback = useCallback(() => {
    if (!recording || !engineRef.current) return;
    engineRef.current.resume();
    setPhase('playing');

    let offset = 0;
    recording.samples.forEach((sample, i) => {
      offset += sample.dt;
      const t = setTimeout(() => {
        const cmd = buildCommand(sample.noteIdx, sample.qualityIdx);
        commandRef.current = cmd;
        signalsRef.current = buildSignals(sample.noteIdx, sample.qualityIdx);
        engineRef.current?.setVibe(VIBES[sample.vibe] ?? 'warm');
        engineRef.current?.play(cmd);

        if (i === recording.samples.length - 1) {
          setTimeout(() => {
            signalsRef.current = [];
            setPhase('done');
          }, 500);
        }
      }, offset);
      timeoutsRef.current.push(t);
    });
  }, [recording]);

  async function handleShareReplay() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (phase === 'error') {
    return (
      <div className="replay-error">
        <p>This replay link is invalid.</p>
        <button className="btn-primary" onClick={() => navigate('/play')}>Play yourself →</button>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />

      {phase === 'ready' && recording && (
        <div className="replay-ready" onClick={startPlayback}>
          <p className="replay-tap">Tap to play</p>
        </div>
      )}

      {phase === 'playing' && (
        <div className="replay-badge">▶ playing…</div>
      )}

      {phase === 'done' && (
        <div className="replay-end">
          <button className="btn-primary" onClick={handleShareReplay}>
            {copied ? 'Copied!' : '↗ Share this'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/play')}>
            Play yourself →
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add replay styles**

Append to `src/App.css`:

```css
.replay-ready {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.replay-tap {
  font-family: monospace;
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.5);
}

.replay-badge {
  position: fixed;
  top: 1rem;
  left: 1rem;
  font-family: monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

.replay-end {
  position: fixed;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  align-items: center;
}

.replay-error {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  background: #0A0E1A;
  font-family: monospace;
  color: rgba(255,255,255,0.6);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReplayShell.tsx src/App.css
git commit -m "feat: add ReplayShell with URL-decoded audio playback and renderer"
```

---

### Task 6: Wire /replay route

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `<ReplayShell />` from `./components/ReplayShell`
- Produces: `/replay` route live in the app

- [ ] **Step 1: Add the route**

Replace `src/App.tsx` with:

```tsx
import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PlayShell from './components/PlayShell';
import ReplayShell from './components/ReplayShell';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
      <Route path="/replay" element={<ReplayShell />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /replay route"
```

---

## Self-Review

**Spec coverage:**
- [x] Record button in play shell — Task 4
- [x] Record/Stop/Share states — Task 4 (`RecordButton`)
- [x] 30s auto-stop — Task 3 (`useRecorder`)
- [x] 10Hz sampling — Task 3 (`setInterval(100)`)
- [x] 5-byte binary format — Task 2 (`codec`)
- [x] base64url encoding — Task 2
- [x] Progress bar during recording — Task 4 (`.record-progress`)
- [x] `/replay?d=…` URL — Task 3 (`shareUrl` generation)
- [x] Replay page decodes URL — Task 5 (`useSearchParams`)
- [x] Replay plays audio — Task 5 (`engine.play(cmd)`)
- [x] Dials animate during replay — Task 5 (`signalsRef` synthetic signals)
- [x] Warm-zone + particles during replay — Task 5 (`commandRef` updated each sample)
- [x] "Tap to play" start (autoplay policy) — Task 5
- [x] End state: Share + Play buttons — Task 5
- [x] Error state for malformed URL — Task 5
- [x] Route wired in App — Task 6

**Type consistency check:**
- `RecordingSample` defined Task 1, used in Task 2, 3 ✓
- `Recording` defined Task 1, used in Task 2, 3, 5 ✓
- `encode(Recording): string` defined Task 2, used in Task 3 ✓
- `decode(string): Recording` defined Task 2, used in Task 5 ✓
- `useRecorder(signalsRef, vibe)` defined Task 3, consumed in Task 4 ✓
- `buildCommand(noteIdx, qualityIdx): MusicalCommand` inline in Task 5 ✓
- `buildSignals(noteIdx, qualityIdx): GestureSignal[]` inline in Task 5 ✓
