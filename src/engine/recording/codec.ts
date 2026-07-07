import type { Recording, RecordingSample } from '../types';

// Consecutive samples with the same selection collapse into one record whose
// dt is the total hold time — a chord held for 3s is one 5-byte record, not
// 30. Cuts share URLs ~10-50x (they were >2000 chars at 30s). The byte
// layout is unchanged and dt was always "ms covered by this record", so
// decode() and the replay player handle merged and legacy links identically.
function runLengthMerge(samples: RecordingSample[]): RecordingSample[] {
  const runs: RecordingSample[] = [];
  for (const s of samples) {
    const last = runs[runs.length - 1];
    if (
      last &&
      last.noteIdx === s.noteIdx &&
      last.qualityIdx === s.qualityIdx &&
      last.vibe === s.vibe &&
      last.dt + s.dt <= 0xffff // dt is a uint16 — overflow starts a new run
    ) {
      last.dt += s.dt;
    } else {
      runs.push({ ...s });
    }
  }
  return runs;
}

export function encode(recording: Recording): string {
  const samples = runLengthMerge(recording.samples);
  const buf = new Uint8Array(samples.length * 5);
  const view = new DataView(buf.buffer);
  samples.forEach((s, i) => {
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
