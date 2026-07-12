import { useState } from 'react';
import {
  diatonicSlices, intervalLabel,
  type CustomWheel, type ScaleName, type TriadQuality, type WheelSlice,
} from '../engine/music';

const QUALITIES: { value: TriadQuality; label: string }[] = [
  { value: 'maj', label: 'major' },
  { value: 'min', label: 'minor' },
  { value: 'dim', label: 'dim' },
  { value: 'aug', label: 'aug' },
];

export default function WheelEditor({ keyOffset, scale, initial, onSave, onDelete, onClose }: {
  keyOffset: number;
  scale: ScaleName;
  initial: CustomWheel | null;
  onSave: (name: string, slices: WheelSlice[], id?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slices, setSlices] = useState<WheelSlice[]>(initial?.slices ?? diatonicSlices(scale));

  const setSlice = (i: number, patch: Partial<WheelSlice>) =>
    setSlices(s => s.map((sl, j) => (j === i ? { ...sl, ...patch } : sl)));

  return (
    <div className="wheel-editor" role="dialog" aria-label="Custom wheel editor">
      <label>
        wheel name
        <input value={name} onChange={e => setName(e.target.value)} aria-label="wheel name" />
      </label>
      {slices.map((slice, i) => (
        <div key={i} className="wheel-editor-row">
          <span className="wheel-editor-slice">{i + 1}</span>
          <select
            aria-label={`slice ${i + 1} root`}
            value={slice.interval}
            onChange={e => setSlice(i, { interval: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, interval) => (
              <option key={interval} value={interval}>{intervalLabel(keyOffset, interval)}</option>
            ))}
          </select>
          <select
            aria-label={`slice ${i + 1} quality`}
            value={slice.quality}
            onChange={e => setSlice(i, { quality: e.target.value as TriadQuality })}
          >
            {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        </div>
      ))}
      <div className="wheel-editor-actions">
        <button onClick={() => onSave(name.trim() || 'my wheel', slices, initial?.id)}>save</button>
        {initial && <button onClick={() => onDelete(initial.id)}>delete</button>}
        <button onClick={onClose}>cancel</button>
      </div>
    </div>
  );
}
