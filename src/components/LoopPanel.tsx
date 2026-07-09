import { MIN_BPM, MAX_BPM } from '../engine/audio';
import { MAX_SLOTS, type ChordLooper, type LooperState } from '../engine/looper';

// Chord looper controls: capture the current chord into slots, then play the
// progression back in tempo and solo over it with the free hand.
export default function LoopPanel({
  looper,
  state,
  onAddChord,
  maxSlots = MAX_SLOTS,
}: {
  looper: ChordLooper;
  state: LooperState;
  onAddChord: () => void;
  /** Plan-gated slot cap (see src/entitlements.ts); engine caps at MAX_SLOTS. */
  maxSlots?: number;
}) {
  const { slots, playing, bpm, beatsPerSlot, currentSlot } = state;
  const full = slots.length >= Math.min(maxSlots, MAX_SLOTS);
  const empty = slots.length === 0;

  return (
    <div className="loop-panel" role="group" aria-label="Chord looper">
      <div className="loop-slots" aria-label="Loop progression">
        {empty ? (
          <span className="loop-empty">Add chords to build a loop</span>
        ) : (
          slots.map((label, i) => (
            <span
              key={i}
              className={`loop-slot${playing && i === currentSlot ? ' loop-slot--active' : ''}`}
            >
              {label}
            </span>
          ))
        )}
      </div>

      <div className="loop-controls">
        <button
          className="loop-btn"
          onClick={onAddChord}
          disabled={full}
          title={full ? `Loop is full (${MAX_SLOTS} chords)` : 'Add the current chord'}
        >
          + chord
        </button>
        <button className="loop-btn" onClick={() => looper.undo()} disabled={empty} aria-label="Remove last chord">
          ⌫
        </button>
        <button className="loop-btn" onClick={() => looper.clear()} disabled={empty}>
          clear
        </button>

        <div className="loop-bpm" role="group" aria-label="Tempo">
          <button
            className="octave-btn"
            onClick={() => looper.setBpm(bpm - 5)}
            disabled={bpm <= MIN_BPM}
            aria-label="Slower"
          >
            −
          </button>
          <span className="loop-bpm-value">{bpm} bpm</span>
          <button
            className="octave-btn"
            onClick={() => looper.setBpm(bpm + 5)}
            disabled={bpm >= MAX_BPM}
            aria-label="Faster"
          >
            +
          </button>
        </div>

        <button
          className="loop-btn"
          onClick={() => looper.setBeatsPerSlot(beatsPerSlot === 4 ? 2 : beatsPerSlot === 2 ? 1 : 4)}
          title="Beats each chord holds before the loop moves on"
          aria-label={`Beats per chord: ${beatsPerSlot}`}
        >
          ♩×{beatsPerSlot}
        </button>

        <button
          className={`loop-btn loop-btn--play${playing ? ' is-playing' : ''}`}
          onClick={() => looper.toggle()}
          disabled={empty}
        >
          {playing ? '■ stop' : '▶ play'}
        </button>
      </div>
    </div>
  );
}
