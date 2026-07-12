import { Mp3Encoder } from '@breezystack/lamejs';

export function floatTo16BitPCM(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

const KBPS = 128;
const CHUNK = 1152; // lame frame size

// 128 kbps MP3 from a decoded AudioBuffer — mono if the source is mono,
// otherwise stereo (channels beyond 2 are dropped; lamejs only does 1/2).
export function encodeMp3(buffer: AudioBuffer): Blob {
  const ch = Math.min(2, buffer.numberOfChannels);
  const enc = new Mp3Encoder(ch, buffer.sampleRate, KBPS);
  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = ch === 2 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;
  const parts: BlobPart[] = [];
  for (let i = 0; i < left.length; i += CHUNK) {
    const l = left.subarray(i, i + CHUNK);
    const buf = ch === 2
      ? enc.encodeBuffer(l, right!.subarray(i, i + CHUNK))
      : enc.encodeBuffer(l);
    // lamejs's Uint8Array is typed over ArrayBufferLike; copy into a fresh
    // one backed by a plain ArrayBuffer so it satisfies BlobPart.
    if (buf.length) parts.push(new Uint8Array(buf));
  }
  const flush = enc.flush();
  if (flush.length) parts.push(new Uint8Array(flush));
  return new Blob(parts, { type: 'audio/mpeg' });
}
