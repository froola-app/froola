import { MIN_BPM, MAX_BPM } from '../engine/audio';
import { MAX_SLOTS, type ChordLooper, type LooperState, type SavedLoop } from '../engine/looper';

// Chord looper controls: capture the current chord into slots, then play the
// progression back in tempo and solo over it with the free hand.
export default function LoopPanel({
  looper,
  state,
  onAddChord,
  maxSlots = MAX_SLOTS,
  armed,
  onToggleArm,
  savedLoops,
  onSaveLoop,
  onLoadLoop,
  onDeleteLoop,
}: {
  looper: ChordLooper;
  state: LooperState;
  onAddChord: () => void;
  /** Plan-gated slot cap (see src/entitlements.ts); engine caps at MAX_SLOTS. */
  maxSlots?: number;
  /** Whether record-arm auto-capture is active. */
  armed: boolean;
  onToggleArm: () => void;
  savedLoops: SavedLoop[];
  onSaveLoop: (name: string) => void;
  onLoadLoop: (loop: SavedLoop) => void;
  onDeleteLoop: (name: string) => void;
}) {
  const { slots, playing, bpm, beatsPerSlot, currentSlot } = state;
  const full = slots.length >= Math.min(maxSlots, MAX_SLOTS);
  const empty = slots.length === 0;

  function handleSaveLoop() {
    const name = window.prompt('Name this loop');
    if (!name) return;
    onSaveLoop(name);
  }

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
          className={`loop-btn loop-btn--arm${armed ? ' is-armed' : ''}`}
          onClick={onToggleArm}
          aria-pressed={armed}
          title={armed ? 'Disarm record-arm capture' : 'Arm: auto-capture each fist lock'}
        >
          {armed ? '■ armed' : '● arm'}
        </button>
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

        <button
          className="loop-btn"
          onClick={handleSaveLoop}
          disabled={empty}
        >
          Save loop…
        </button>
      </div>

      <div className="loop-saved" aria-label="Saved loops">
        {savedLoops.map(loop => (
          <div className="loop-saved-row" key={loop.name}>
            <span className="loop-saved-name" title={loop.name}>{loop.name}</span>
            <button className="loop-btn" onClick={() => onLoadLoop(loop)}>Load</button>
            <button className="loop-btn" onClick={() => onDeleteLoop(loop.name)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
