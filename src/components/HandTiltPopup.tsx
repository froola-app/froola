import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import type { HandFacing } from '../engine/input/handFacing';

// Nudges the user to face their palm toward the camera. A hand must be
// continuously off-plane for GRACE_MS before the popup appears, and back to
// ok for CLEAR_MS before it hides, so brief wobbles never flash it.
const POLL_MS = 100;
const GRACE_MS = 1200;
const CLEAR_MS = 600;

type TiltIssue = { handId: 'left' | 'right'; facing: Exclude<HandFacing, 'ok'> };

const COPY: Record<TiltIssue['facing'], { now: string; fix: string }> = {
  turned: {
    now: 'is turned sideways',
    fix: 'Rotate it so your palm faces the camera.',
  },
  pitched: {
    now: 'is leaning toward the camera',
    fix: 'Hold it upright, palm flat toward the camera.',
  },
};

export default function HandTiltPopup({ signalRef }: { signalRef: RefObject<GestureSignal[]> }) {
  const [issue, setIssue] = useState<TiltIssue | null>(null);

  useEffect(() => {
    let badSince: number | null = null;
    let okSince: number | null = null;
    const id = setInterval(() => {
      const signals = signalRef.current ?? [];
      // A fist is an intentional gesture (chord lock) — don't nag about it.
      const bad = signals.find(
        s => s.present && !s.fist && (s.facing === 'turned' || s.facing === 'pitched')
      );
      const now = performance.now();
      if (bad) {
        okSince = null;
        if (badSince === null) badSince = now;
        if (now - badSince >= GRACE_MS) {
          const next: TiltIssue = { handId: bad.handId, facing: bad.facing as TiltIssue['facing'] };
          setIssue(prev =>
            prev && prev.handId === next.handId && prev.facing === next.facing ? prev : next
          );
        }
      } else {
        badSince = null;
        if (okSince === null) okSince = now;
        if (now - okSince >= CLEAR_MS) setIssue(prev => (prev === null ? prev : null));
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [signalRef]);

  if (!issue) return null;

  const copy = COPY[issue.facing];
  // 🖐️ is a right hand; mirror it for the left. The "current" glyph is then
  // 3D-rotated to echo the detected tilt, next to a flat "target" glyph.
  const mirror = issue.handId === 'left' ? 'scaleX(-1) ' : '';
  const currentTransform =
    mirror + (issue.facing === 'turned' ? 'rotateY(65deg)' : 'rotateX(55deg)');

  return (
    <div className="tilt-popup" role="status">
      <div className="tilt-popup__hands" aria-hidden="true">
        <span className="tilt-popup__hand" style={{ transform: currentTransform }}>🖐️</span>
        <span className="tilt-popup__arrow">→</span>
        <span className="tilt-popup__hand tilt-popup__hand--target" style={{ transform: mirror || undefined }}>🖐️</span>
      </div>
      <p className="tilt-popup__text">
        Your <strong>{issue.handId} hand</strong> {copy.now}. {copy.fix}
      </p>
    </div>
  );
}
