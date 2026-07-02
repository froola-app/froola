#!/usr/bin/env python3
"""Extract a melody line from your own licensed audio into Froola melody data.

Runs entirely locally: Demucs isolates the vocal stem, torchcrepe tracks its
pitch, and the notes are quantized to a 16th grid and written as the JSON the
app loads from public/melodies/ (gitignored — melody data is never committed).

Setup (once):
    python3 -m venv .venv && .venv/bin/pip install torch torchaudio demucs torchcrepe soundfile numpy

Usage:
    .venv/bin/python extract_melody.py <audio-file> <start-sec> <duration-sec> <out.json>
e.g.
    .venv/bin/python extract_melody.py song.mp3 20 30 ../../public/melodies/love-yourself.json

Output notes are {step, midi, dur} with step = 16th-note index from clip
start. Expect ~90% accuracy on a clean vocal — do a listening pass in the app
and re-run with tweaked bounds if needed.
"""
import json, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchcrepe

FMIN, FMAX = 80.0, 700.0
HOP_S = 0.010
PERIODICITY_MIN = 0.45
ENERGY_GATE_DB = 35     # keep frames within this many dB of the loudest
MIN_NOTE_S = 0.09
MERGE_GAP_S = 0.08


def separate_vocals(clip_wav: Path, workdir: Path) -> Path:
    subprocess.run(
        [sys.executable, '-m', 'demucs', '-n', 'htdemucs', '--two-stems', 'vocals',
         '-o', str(workdir), str(clip_wav)],
        check=True,
    )
    return workdir / 'htdemucs' / clip_wav.stem / 'vocals.wav'


def track_pitch(vocals_wav: Path):
    v, sr = sf.read(vocals_wav)
    if v.ndim > 1:
        v = v.mean(axis=1)
    vt = torch.tensor(v, dtype=torch.float32).unsqueeze(0)
    vt16 = torchaudio.functional.resample(vt, sr, 16000)
    hop = int(16000 * HOP_S)
    f0, per = torchcrepe.predict(vt16, 16000, hop, FMIN, FMAX, 'full',
                                 return_periodicity=True, batch_size=512, device='cpu')
    f0, per = f0[0].numpy(), per[0].numpy()
    x = vt16[0].numpy()
    n = len(f0)
    rms = np.array([
        np.sqrt((x[i * hop:(i + 1) * hop] ** 2).mean() + 1e-12) if (i + 1) * hop <= len(x) else 0.0
        for i in range(n)
    ])
    db = 20 * np.log10(rms + 1e-9)
    voiced = (per > PERIODICITY_MIN) & (db > db.max() - ENERGY_GATE_DB)
    midi = 69 + 12 * np.log2(f0 / 440.0)
    return midi, voiced


def segment(midi: np.ndarray, voiced: np.ndarray):
    notes, i, n = [], 0, len(midi)
    while i < n:
        if not voiced[i]:
            i += 1
            continue
        j, pitches = i, [midi[i]]
        while j + 1 < n and voiced[j + 1] and abs(midi[j + 1] - np.median(pitches)) < 0.8:
            j += 1
            pitches.append(midi[j])
        dur = (j - i + 1) * HOP_S
        if dur >= MIN_NOTE_S:
            notes.append({'t': i * HOP_S, 'dur': dur, 'midi': int(round(np.median(pitches)))})
        i = j + 1
    merged = []
    for nt in notes:
        prev = merged[-1] if merged else None
        if prev and nt['midi'] == prev['midi'] and nt['t'] - (prev['t'] + prev['dur']) < MERGE_GAP_S:
            prev['dur'] = nt['t'] + nt['dur'] - prev['t']
        else:
            merged.append(dict(nt))
    # fold octave-error outliers back toward the median register
    med = np.median([n['midi'] for n in merged])
    for nt in merged:
        while nt['midi'] < med - 7:
            nt['midi'] += 12
        while nt['midi'] > med + 7:
            nt['midi'] -= 12
    return merged


def quantize(notes, bpm: float):
    six = 60.0 / bpm / 4
    offsets = np.arange(0, six, 0.005)
    def cost(o):
        return np.mean([min((n['t'] - o) % six, six - (n['t'] - o) % six) for n in notes])
    best = min(offsets, key=cost)
    out = [{'step': round((n['t'] - best) / six), 'midi': n['midi'],
            'dur': max(1, round(n['dur'] / six))} for n in notes]
    base = min(o['step'] for o in out)
    for o in out:
        o['step'] -= base
    out.sort(key=lambda o: o['step'])
    mono = []
    for o in out:
        if mono and o['step'] < mono[-1]['step'] + 1:
            continue
        mono.append(o)
    return mono


def estimate_bpm(clip_wav: Path) -> float:
    d, sr = sf.read(clip_wav)
    if d.ndim > 1:
        d = d.mean(axis=1)
    hop = int(sr * HOP_S)
    env = np.array([np.abs(d[i * hop:(i + 1) * hop]).mean() for i in range(len(d) // hop)])
    onset = np.maximum(np.diff(env), 0)
    ac = np.correlate(onset, onset, 'full')[len(onset) - 1:]
    best, best_v = None, -1
    for li in range(30, 200):  # lags 0.3–2.0s → 30–200 bpm
        bpm = 60 / (li * HOP_S)
        if 60 <= bpm <= 180 and ac[li] > best_v:
            best, best_v = bpm, ac[li]
    return round(best, 1)


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    src, start, dur, out = Path(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), Path(sys.argv[4])

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        data, sr = sf.read(src, start=int(start * 44100), frames=int(dur * 44100))
        clip = work / 'clip.wav'
        sf.write(clip, data, sr)

        bpm = estimate_bpm(clip)
        print(f'estimated bpm: {bpm}')

        vocals = separate_vocals(clip, work)
        midi, voiced = track_pitch(vocals)
        notes = segment(midi, voiced)
        mono = quantize(notes, bpm)

    out.parent.mkdir(parents=True, exist_ok=True)
    json.dump(mono, out.open('w'))
    span = mono[-1]['step'] + mono[-1]['dur'] if mono else 0
    print(f'{len(mono)} notes → {out} (span: {span} sixteenth-steps at {bpm} bpm)')


if __name__ == '__main__':
    main()
