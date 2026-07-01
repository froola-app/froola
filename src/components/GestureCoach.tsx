import { useState } from 'react';

// Shown once per browser, the first time someone starts playing — the gesture
// mechanics (two wheels, right-fist latch, octave keys) are otherwise invisible.
const SEEN_KEY = 'froola.coachSeen';

function hasSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode — just skip */ }
}

export default function GestureCoach({ mode }: { mode: 'camera' | 'mouse' }) {
  const [open, setOpen] = useState(() => !hasSeen());
  if (!open) return null;

  const isCamera = mode === 'camera';
  const tips = [
    {
      icon: isCamera ? '🙌' : '🖱️',
      text: isCamera
        ? 'Put both hands on the wheels to play a chord'
        : 'Move over the wheels to play a chord',
    },
    {
      icon: '🎯',
      text: isCamera
        ? 'Left wheel picks the chord, right wheel adds flavour (7th, sus…)'
        : 'Left wheel plays the chord; dial the right wheel to set a flavour (7th, sus…) — it sticks',
    },
    ...(isCamera
      ? [{ icon: '👊', text: 'Make a right fist to hold a chord and solo with your left hand' }]
      : []),
    { icon: '⌨️', text: 'Press ↑ / ↓ to change octave' },
  ];

  function dismiss() {
    markSeen();
    setOpen(false);
  }

  return (
    <div className="coach-overlay" role="dialog" aria-label="How to play">
      <div className="coach-card">
        <h2 className="coach-title">How to play</h2>
        <ul className="coach-tips">
          {tips.map((t, i) => (
            <li key={i} className="coach-tip">
              <span className="coach-tip__icon" aria-hidden="true">{t.icon}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
        <button className="coach-btn" onClick={dismiss}>Got it</button>
      </div>
    </div>
  );
}
