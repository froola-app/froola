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

// v1 payloads prepend a single flags byte, distinguishable from the legacy
// all-samples format because their length is ≡1 (mod 5) instead of ≡0. The
// high bits form a version marker so a corrupt legacy payload that happens
// to be ≡1 (mod 5) still fails validation instead of decoding as v1.
const FLAGS_VERSION = 0x80;
const FLAG_NO_WATERMARK = 0x01;

export function encode(recording: Recording): string {
  const samples = runLengthMerge(recording.samples);
  const buf = new Uint8Array(1 + samples.length * 5);
  buf[0] = FLAGS_VERSION | (recording.watermark === false ? FLAG_NO_WATERMARK : 0);
  const view = new DataView(buf.buffer);
  samples.forEach((s, i) => {
    view.setUint16(1 + i * 5, s.dt, false);
    buf[1 + i * 5 + 2] = s.noteIdx;
    buf[1 + i * 5 + 3] = s.qualityIdx;
    buf[1 + i * 5 + 4] = s.vibe;
  });
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decode(data: string): Recording {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  // Legacy links carry no flags byte — every one predates paid plans, so
  // they play back watermarked.
  let watermark = true;
  let offset = 0;
  if (buf.length % 5 === 1 && (buf[0] & 0xf0) === FLAGS_VERSION) {
    watermark = (buf[0] & FLAG_NO_WATERMARK) === 0;
    offset = 1;
  } else if (buf.length === 0 || buf.length % 5 !== 0) {
    throw new Error('Invalid recording data');
  }
  if (buf.length - offset === 0) {
    throw new Error('Invalid recording data');
  }

  const view = new DataView(buf.buffer);
  const samples: RecordingSample[] = [];
  let totalMs = 0;

  for (let i = offset; i < buf.length; i += 5) {
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

  return { samples, totalMs, watermark };
}
