// Keyboard + mouse composition for pointer input mode.
//
// A single mouse pointer can only be on one wheel at a time, so pointer mode
// gets a keyboard path too: holding 1–7 plays a note slice on the left wheel
// and holding Q–U picks an extension slice on the right wheel. Held keys are
// turned into synthetic GestureSignals positioned at the centre of their
// slice, so the whole downstream pipeline (renderer hit-test + hysteresis,
// coordinator audio, recorder) treats them exactly like a hand or the mouse.

import type { GestureSignal } from '../types';
import { NOTES } from '../types';
import { EXTENSIONS } from '../music/keyScale';
import { wheelGeometry, sliceToPoint } from '../renderer/geometry';
import { pointerHandId } from './index';

// Slice order is clockwise from the top, matching the drawn wheel labels.
export const NOTE_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
export const EXTENSION_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u'] as const;

export function noteKeyIndex(key: string): number | null {
  const i = (NOTE_KEYS as readonly string[]).indexOf(key);
  return i === -1 ? null : i;
}

export function extensionKeyIndex(key: string): number | null {
  const i = (EXTENSION_KEYS as readonly string[]).indexOf(key.toLowerCase());
  return i === -1 ? null : i;
}

// Build the signal array for pointer mode from the live mouse position and
// the currently held note/extension keys. A held key owns its hand; the mouse
// covers whichever hand (screen half) the keyboard isn't holding.
export function composePointerSignals(
  mouse: { x: number; y: number } | null,
  heldNoteIdx: number | null,
  heldExtIdx: number | null,
  w: number,
  h: number,
): GestureSignal[] {
  const { outerR, leftCx, rightCx, cy } = wheelGeometry(w, h);
  const signals: GestureSignal[] = [];

  if (heldNoteIdx !== null) {
    const p = sliceToPoint(heldNoteIdx, NOTES.length, leftCx, cy, outerR, w, h);
    signals.push({ ...p, present: true, handId: 'left' });
  }
  if (heldExtIdx !== null) {
    const p = sliceToPoint(heldExtIdx, EXTENSIONS.length, rightCx, cy, outerR, w, h);
    signals.push({ ...p, present: true, handId: 'right' });
  }
  if (mouse) {
    const handId = pointerHandId(mouse.x);
    if (!signals.some(s => s.handId === handId)) {
      signals.push({ x: mouse.x, y: mouse.y, present: true, handId });
    }
  }
  return signals;
}
