# SP3 — Performance Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a landing page at `/`, audio-reactive particles on the canvas, and a share button that copies `/play` to the clipboard.

**Architecture:** React Router splits the app into two routes — `/` (static landing) and `/play` (existing instrument). A `ParticleSystem` class is added to the renderer pipeline, reading amplitude from the analyser and tension from `commandRef` (added by SP2). A `ShareButton` overlay sits in the play shell.

**Tech Stack:** React 19, TypeScript 6, Vite 8, react-router-dom, vitest + @testing-library/react (added here), Canvas2D.

## Global Constraints

- No new audio logic — particles read existing `analyserRef` and `commandRef` only
- `commandRef` is added to `useRenderer` by SP2; Tasks 1–6 are SP2-independent, Tasks 7–8 require SP2 merged
- Particle cap: 60 max at any time
- `npm run build` must produce zero TypeScript errors at end of every task
- All commits are small and focused — one logical unit per commit
- Monospace font, dark semi-transparent pill aesthetic for all new UI elements

---

### Task 1: Add Vitest + testing-library

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test-setup.ts`

**Interfaces:**
- Produces: `npm test` script that runs vitest; global `describe/it/expect` available in `*.test.ts` files

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/testing-library__jest-dom
```

- [ ] **Step 2: Add test script to package.json**

Open `package.json` and add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure vitest in vite.config.ts**

Replace the full contents of `vite.config.ts` with:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Create test setup file**

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Create a smoke test to verify setup**

Create `src/test-setup.test.ts`:

```typescript
describe('test setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected output: `1 passed`

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.ts src/test-setup.ts src/test-setup.test.ts package-lock.json
git commit -m "chore: add vitest + testing-library test setup"
```

---

### Task 2: Add React Router and configure routes

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: two routes — `/` renders `<LandingPage />` placeholder, `/play` renders existing `<AppCanvas />`
- Consumes: nothing new — wraps existing `AppCanvas` content

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
npm install -D @types/react-router-dom
```

- [ ] **Step 2: Wrap app in BrowserRouter**

Open `src/main.tsx`. It currently looks like:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Replace with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3: Add routes to App.tsx**

Replace the full contents of `src/App.tsx` with:

```tsx
import { useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useCoordinator } from './coordinator';
import './App.css';

// ---------- existing play-screen pieces (unchanged) ----------

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

function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode, requestCamera, useMouse } = useCoordinator(canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
    </>
  );
}

// ---------- landing page placeholder ----------

function LandingPage() {
  return <div className="landing-screen"><p>landing — coming in Task 3</p></div>;
}

// ---------- router ----------

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx package.json package-lock.json
git commit -m "feat: add react-router-dom with / and /play routes"
```

---

### Task 3: Landing page component + styles

**Files:**
- Create: `src/components/LandingPage.tsx`
- Modify: `src/App.tsx` (swap placeholder for real component)
- Modify: `src/App.css`

**Interfaces:**
- Produces: `<LandingPage />` — renders hero screen, navigates to `/play` on button click
- Consumes: `useNavigate` from react-router-dom

- [ ] **Step 1: Create the component**

Create `src/components/LandingPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-screen">
      <h1 className="landing-title">froola</h1>
      <p className="landing-tagline">play music with your hands</p>
      <button className="btn-primary" onClick={() => navigate('/play')}>
        Play →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Open `src/App.css` and append at the bottom:

```css
.landing-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0A0E1A;
  gap: 1.5rem;
}

.landing-title {
  font-family: monospace;
  font-size: 4rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.1em;
  margin: 0;
}

.landing-tagline {
  font-family: monospace;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}
```

- [ ] **Step 3: Swap placeholder in App.tsx**

In `src/App.tsx`, replace the inline `LandingPage` function and add the import:

Remove:
```tsx
function LandingPage() {
  return <div className="landing-screen"><p>landing — coming in Task 3</p></div>;
}
```

Add at the top of the file (with other imports):
```tsx
import LandingPage from './components/LandingPage';
```

- [ ] **Step 4: Write a component test**

Create `src/components/LandingPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';

function Harness() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<div>play shell</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  it('renders title and tagline', () => {
    render(<Harness />);
    expect(screen.getByText('froola')).toBeInTheDocument();
    expect(screen.getByText('play music with your hands')).toBeInTheDocument();
  });

  it('navigates to /play on button click', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(screen.getByText('play shell')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 3 passed (smoke + 2 landing tests)

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/LandingPage.tsx src/components/LandingPage.test.tsx src/App.tsx src/App.css
git commit -m "feat: add landing page at / with Play CTA"
```

---

### Task 4: Extract PlayShell into its own file

**Files:**
- Create: `src/components/PlayShell.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `<PlayShell />` — self-contained play screen, exported from `src/components/PlayShell.tsx`
- Consumes: `useCoordinator` from `src/coordinator`

- [ ] **Step 1: Create PlayShell.tsx**

Create `src/components/PlayShell.tsx`:

```tsx
import { useRef } from 'react';
import { useCoordinator } from '../coordinator';

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
  const { mode, requestCamera, useMouse } = useCoordinator(canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update App.tsx to use the extracted component**

Replace `src/App.tsx` with:

```tsx
import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PlayShell from './components/PlayShell';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
    </Routes>
  );
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
git add src/components/PlayShell.tsx src/App.tsx
git commit -m "refactor: extract PlayShell into its own component"
```

---

### Task 5: Share button

**Files:**
- Create: `src/components/ShareButton.tsx`
- Modify: `src/components/PlayShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `<ShareButton />` — copies `window.location.origin + '/play'` to clipboard, shows "Copied!" for 1.5s
- Consumes: `navigator.clipboard.writeText`

- [ ] **Step 1: Create ShareButton.tsx**

Create `src/components/ShareButton.tsx`:

```tsx
import { useState } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.origin + '/play');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="share-btn" onClick={handleShare}>
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/App.css`:

```css
.share-btn {
  position: fixed;
  top: 1rem;
  right: 1rem;
  font-family: monospace;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  z-index: 20;
}

.share-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.95);
}
```

- [ ] **Step 3: Mount ShareButton in PlayShell**

In `src/components/PlayShell.tsx`, add the import and mount the component:

Add import at top:
```tsx
import ShareButton from './ShareButton';
```

Add `<ShareButton />` inside the returned JSX, after the `MouseModeBadge` conditional:

```tsx
export default function PlayShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode, requestCamera, useMouse } = useCoordinator(canvasRef);

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
    </>
  );
}
```

- [ ] **Step 4: Write ShareButton tests**

Create `src/components/ShareButton.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from './ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://froola.app' },
      writable: true,
    });
  });

  it('renders Share label by default', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('copies /play URL on click and shows Copied!', async () => {
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://froola.app/play');
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('reverts to Share after 1.5s', async () => {
    vi.useFakeTimers();
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ShareButton.tsx src/components/ShareButton.test.tsx src/components/PlayShell.tsx src/App.css
git commit -m "feat: add Share button that copies /play URL to clipboard"
```

---

### Task 6: ParticleSystem class + unit tests

**Files:**
- Create: `src/engine/renderer/particles.ts`
- Create: `src/engine/renderer/particles.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  class ParticleSystem {
    spawn(x: number, y: number, amplitude: number, tension: number): void
    tick(ctx: CanvasRenderingContext2D): void
    get count(): number  // number of live particles
  }
  ```
- Consumes: nothing from other tasks — pure logic class

- [ ] **Step 1: Write the failing tests first**

Create `src/engine/renderer/particles.test.ts`:

```typescript
import { ParticleSystem } from './particles';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ParticleSystem', () => {
  it('starts with zero particles', () => {
    const ps = new ParticleSystem();
    expect(ps.count).toBe(0);
  });

  it('spawns particles proportional to amplitude', () => {
    const ps = new ParticleSystem();
    ps.spawn(100, 100, 1.0, 0.0); // amplitude=1 → up to 3 particles
    expect(ps.count).toBeGreaterThan(0);
    expect(ps.count).toBeLessThanOrEqual(3);
  });

  it('spawns no particles when amplitude is 0', () => {
    const ps = new ParticleSystem();
    ps.spawn(100, 100, 0, 0.5);
    expect(ps.count).toBe(0);
  });

  it('never exceeds MAX (60) particles', () => {
    const ps = new ParticleSystem();
    for (let i = 0; i < 100; i++) {
      ps.spawn(100, 100, 1.0, 0.5);
    }
    expect(ps.count).toBeLessThanOrEqual(60);
  });

  it('tick reduces particle count over time (particles decay)', () => {
    const ps = new ParticleSystem();
    const ctx = makeCtx();
    ps.spawn(100, 100, 1.0, 0.0);
    const initial = ps.count;
    // Run enough ticks for at least one particle to die (life 1.0 - 0.015/frame * ~70 frames)
    for (let i = 0; i < 100; i++) ps.tick(ctx);
    expect(ps.count).toBeLessThan(initial);
  });

  it('tick calls ctx.save and ctx.restore once per call', () => {
    const ps = new ParticleSystem();
    const ctx = makeCtx();
    ps.spawn(100, 100, 1.0, 0.0);
    ps.tick(ctx);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `particles.ts` not found.

- [ ] **Step 3: Implement ParticleSystem**

Create `src/engine/renderer/particles.ts`:

```typescript
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;   // 1.0 → 0.0
  decay: number;
  radius: number;
  r: number; g: number; b: number;  // color channels (alpha = life)
};

const MAX = 60;

// Lerp tension (0–1) → RGB between amber (0.0), orange (0.5), indigo (1.0)
function tensionRGB(tension: number): [number, number, number] {
  if (tension <= 0.5) {
    const t = tension * 2;
    return [
      Math.round(245 + (251 - 245) * t),
      Math.round(158 + (100 - 158) * t),
      Math.round(11  + (0   - 11)  * t),
    ];
  }
  const t = (tension - 0.5) * 2;
  return [
    Math.round(251 + (99  - 251) * t),
    Math.round(100 + (102 - 100) * t),
    Math.round(0   + (241 - 0)   * t),
  ];
}

export class ParticleSystem {
  private particles: Particle[] = [];

  get count(): number {
    return this.particles.length;
  }

  spawn(x: number, y: number, amplitude: number, tension: number): void {
    const n = Math.floor(amplitude * 3);
    const [r, g, b] = tensionRGB(tension);

    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + amplitude * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.01,
        radius: 2 + Math.random() * 3,
        r, g, b,
      });
    }
  }

  tick(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.life.toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
    this.particles = this.particles.filter(p => p.life > 0);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass (including new particle tests).

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderer/particles.ts src/engine/renderer/particles.test.ts
git commit -m "feat: add ParticleSystem with amplitude-driven spawn and tension color"
```

---

### Task 7: Integrate particles into renderer

> **Depends on SP2 merged.** SP2 adds `commandRef: RefObject<MusicalCommand | null>` as the 4th parameter of `useRenderer` and wires it in `coordinator.ts`. Complete Tasks 1–6 first, then merge SP2, then do this task.

**Files:**
- Modify: `src/engine/renderer/index.ts`

**Interfaces:**
- Consumes: `ParticleSystem` from `./particles`; `commandRef: RefObject<MusicalCommand | null>` from SP2 (already in signature after SP2 merge)
- Produces: particles rendered each frame, between warm-zone and dials

- [ ] **Step 1: Verify SP2 is merged**

Check that `useRenderer` in `src/engine/renderer/index.ts` already has this signature (added by SP2):

```typescript
export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,
  analyserRef: RefObject<AnalyserNode | null>,
  commandRef: RefObject<MusicalCommand | null>
): void
```

If SP2 is not merged yet, stop and wait.

- [ ] **Step 2: Add ParticleSystem to the renderer**

Open `src/engine/renderer/index.ts`.

Add the import at the top:

```typescript
import { useRef } from 'react';
import { ParticleSystem } from './particles';
import type { MusicalCommand } from '../types';
```

(Note: `useRef` may already be imported — add only what's missing.)

Inside `useRenderer`, add the particle system ref immediately before the `useEffect`:

```typescript
const particlesRef = useRef(new ParticleSystem());
```

- [ ] **Step 3: Wire particle spawn + tick into the draw loop**

Inside the `draw()` function in the `useEffect`, after the warm-zone gradient fill and **before** `drawDial` calls, add:

```typescript
// Particle spawn position: average of present hand positions, or canvas center
const presentSignals = signals.filter(s => s.present);
const spawnX = presentSignals.length > 0
  ? presentSignals.reduce((sum, s) => sum + s.x * w, 0) / presentSignals.length
  : w / 2;
const spawnY = presentSignals.length > 0
  ? presentSignals.reduce((sum, s) => sum + s.y * h, 0) / presentSignals.length
  : h / 2;

const tension = commandRef.current?.tension ?? 0;
particlesRef.current.spawn(spawnX, spawnY, amplitude, tension);
particlesRef.current.tick(ctx);
```

- [ ] **Step 4: Add commandRef to the useEffect dependency array**

The `useEffect` dependency array currently ends with `[canvasRef, signalsRef, analyserRef]`.
Add `commandRef`:

```typescript
}, [canvasRef, signalsRef, analyserRef, commandRef]);
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/renderer/index.ts
git commit -m "feat: integrate audio-reactive particles into canvas renderer"
```

---

### Task 8: Wire SP2 overlays into PlayShell

> **Depends on SP2 merged.** SP2 delivers `VibePicker`, `GuidedOverlay`, and `setVibe` from `useCoordinator`. Do this task after SP2 is merged.

**Files:**
- Modify: `src/components/PlayShell.tsx`

**Interfaces:**
- Consumes:
  - `VibePicker` from `./VibePicker` (SP2)
  - `GuidedOverlay` from `./GuidedOverlay` (SP2)
  - `vibe`, `setVibe` from `useCoordinator` return (SP2)
- Produces: fully wired play shell with vibes, guided overlay, share button, and particles

- [ ] **Step 1: Verify SP2 components exist**

Check that these files exist (created by SP2):
- `src/components/VibePicker.tsx`
- `src/components/GuidedOverlay.tsx`

And that `useCoordinator` in `src/coordinator.ts` returns `{ ..., vibe, setVibe }`.

If SP2 is not merged yet, stop and wait.

- [ ] **Step 2: Update PlayShell to mount SP2 components**

Replace `src/components/PlayShell.tsx` with:

```tsx
import { useRef } from 'react';
import { useCoordinator } from '../coordinator';
import VibePicker from './VibePicker';
import GuidedOverlay from './GuidedOverlay';
import ShareButton from './ShareButton';

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
  const { mode, requestCamera, useMouse, vibe, setVibe } = useCoordinator(canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
      <VibePicker vibe={vibe} onChange={setVibe} />
      <GuidedOverlay />
      <ShareButton />
    </>
  );
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
git add src/components/PlayShell.tsx
git commit -m "feat: wire VibePicker and GuidedOverlay into PlayShell (SP2 integration)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `/` shows landing page with "Play →" CTA — Task 3
- [x] `/play` opens instrument, skip landing — Task 2 (direct navigation)
- [x] Particles appear and react to amplitude — Task 6 + 7
- [x] Particle color shifts with tension — Task 6 (`tensionRGB`)
- [x] Share button copies `/play` URL — Task 5
- [x] "Copied!" confirmation 1.5s — Task 5
- [x] SP2 overlays (VibePicker, GuidedOverlay) in play shell — Task 8
- [x] `npm run build` zero TS errors — each task
- [x] `npm test` all pass — each task

**SP2 dependency gate:** Tasks 7 and 8 are explicitly gated on SP2 merge. Tasks 1–6 are fully independent and can be done in parallel with SP2.
