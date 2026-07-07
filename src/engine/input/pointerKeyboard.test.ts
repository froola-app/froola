import {
  NOTE_KEYS,
  EXTENSION_KEYS,
  noteKeyIndex,
  extensionKeyIndex,
  composePointerSignals,
} from './pointerKeyboard';
import { NOTES } from '../types';
import { EXTENSIONS } from '../music/keyScale';
import { wheelGeometry } from '../renderer/geometry';

const W = 1280;
const H = 800;

// Mirror of the renderer/coordinator hit-test: is this normalized point inside
// the annular ring of the given wheel, and which slice does it select?
function hitTest(x: number, y: number, wheel: 'left' | 'right', n: number) {
  const { outerR, innerR, leftCx, rightCx, cy } = wheelGeometry(W, H);
  const cx = wheel === 'left' ? leftCx : rightCx;
  const px = x * W;
  const py = y * H;
  const d = Math.hypot(px - cx, py - cy);
  const inRing = d >= innerR && d <= outerR;
  const angle = Math.atan2(py - cy, px - cx);
  const normalized = ((angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
  const sliceIdx = Math.round(normalized / (Math.PI * 2) * n) % n;
  return { inRing, sliceIdx };
}

describe('key maps', () => {
  it('covers every note slice with a digit key', () => {
    expect(NOTE_KEYS).toHaveLength(NOTES.length);
  });

  it('covers every extension slice with a letter key', () => {
    expect(EXTENSION_KEYS).toHaveLength(EXTENSIONS.length);
  });

  it('maps keys to slice indices (case-insensitive for letters)', () => {
    expect(noteKeyIndex('1')).toBe(0);
    expect(noteKeyIndex('7')).toBe(6);
    expect(noteKeyIndex('8')).toBeNull();
    expect(extensionKeyIndex('q')).toBe(0);
    expect(extensionKeyIndex('Q')).toBe(0);
    expect(extensionKeyIndex('u')).toBe(6);
    expect(extensionKeyIndex('x')).toBeNull();
  });
});

describe('composePointerSignals', () => {
  it('returns just the mouse signal when no keys are held', () => {
    const signals = composePointerSignals({ x: 0.2, y: 0.6 }, null, null, W, H);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ x: 0.2, y: 0.6, present: true, handId: 'left' });
  });

  it('labels the mouse by screen half', () => {
    const [s] = composePointerSignals({ x: 0.9, y: 0.5 }, null, null, W, H);
    expect(s.handId).toBe('right');
  });

  it('places a held note key inside its slice on the left wheel', () => {
    for (let idx = 0; idx < NOTES.length; idx++) {
      const signals = composePointerSignals(null, idx, null, W, H);
      const left = signals.find(s => s.handId === 'left')!;
      const { inRing, sliceIdx } = hitTest(left.x, left.y, 'left', NOTES.length);
      expect(inRing).toBe(true);
      expect(sliceIdx).toBe(idx);
    }
  });

  it('places a held extension key inside its slice on the right wheel', () => {
    for (let idx = 0; idx < EXTENSIONS.length; idx++) {
      const signals = composePointerSignals(null, null, idx, W, H);
      const right = signals.find(s => s.handId === 'right')!;
      const { inRing, sliceIdx } = hitTest(right.x, right.y, 'right', EXTENSIONS.length);
      expect(inRing).toBe(true);
      expect(sliceIdx).toBe(idx);
    }
  });

  it('lets a held note key own the left hand while the mouse drives the right wheel', () => {
    const signals = composePointerSignals({ x: 0.8, y: 0.65 }, 2, null, W, H);
    const left = signals.find(s => s.handId === 'left');
    const right = signals.find(s => s.handId === 'right');
    expect(left).toBeDefined();
    expect(right).toMatchObject({ x: 0.8, y: 0.65 });
  });

  it('keyboard wins over the mouse for the same hand', () => {
    // Mouse in the left half + note key held: one left signal, from the keyboard.
    const signals = composePointerSignals({ x: 0.1, y: 0.1 }, 0, null, W, H);
    const lefts = signals.filter(s => s.handId === 'left');
    expect(lefts).toHaveLength(1);
    expect(lefts[0].y).not.toBe(0.1);
  });

  it('can hold both wheels from the keyboard alone', () => {
    const signals = composePointerSignals(null, 4, 2, W, H);
    expect(signals.map(s => s.handId).sort()).toEqual(['left', 'right']);
  });
});
