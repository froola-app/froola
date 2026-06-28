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
