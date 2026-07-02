#!/usr/bin/env python3
"""Mix Demucs stems from your own licensed audio into a lesson backing track.

Sums the non-vocal stems (drums + bass + other) into an instrumental, optionally
time-stretches it to the lesson's exact bpm so chord prompts stay in sync, and
writes the wav the app loads from public/melodies/ (gitignored — audio derived
from licensed material is never committed).

Usage:
    .venv/bin/python make_backing.py <stems-dir> <out.wav> [--source-bpm 103.4 --target-bpm 100] [--trim 0.0]

<stems-dir> is Demucs output containing drums.wav / bass.wav / other.wav
(e.g. separated/htdemucs/clip). --trim cuts seconds from the start for
downbeat alignment — tune it by ear in the app.
"""
import argparse
from pathlib import Path

import numpy as np
import soundfile as sf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('stems_dir', type=Path)
    ap.add_argument('out', type=Path)
    ap.add_argument('--source-bpm', type=float, default=None)
    ap.add_argument('--target-bpm', type=float, default=None)
    ap.add_argument('--trim', type=float, default=0.0)
    args = ap.parse_args()

    mix = None
    sr = None
    for name in ('drums.wav', 'bass.wav', 'other.wav'):
        d, sr = sf.read(args.stems_dir / name)
        mix = d if mix is None else mix + d

    if args.trim > 0:
        mix = mix[int(args.trim * sr):]

    if args.source_bpm and args.target_bpm and abs(args.source_bpm - args.target_bpm) > 0.05:
        import torch
        import torchaudio
        rate = args.target_bpm / args.source_bpm  # <1 lengthens (slows down)
        n_fft = 2048
        hop = n_fft // 4
        window = torch.hann_window(n_fft)
        x = torch.tensor(mix.T, dtype=torch.float32)
        spec = torch.stft(x, n_fft, hop, window=window, return_complex=True)
        phase_advance = torch.linspace(0, np.pi * hop, n_fft // 2 + 1).unsqueeze(1)
        stretched = torchaudio.functional.phase_vocoder(spec, rate, phase_advance)
        y = torch.istft(stretched, n_fft, hop, window=window)
        mix = y.T.numpy()
        print(f'time-stretched {args.source_bpm} → {args.target_bpm} bpm')

    peak = np.abs(mix).max() or 1.0
    mix = mix * (0.9 / peak)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.out, mix, sr)
    print(f'{args.out} written ({len(mix)/sr:.1f}s at {sr}Hz)')


if __name__ == '__main__':
    main()
