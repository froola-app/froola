import { describe, it, expect } from 'vitest'
import { backingSequence } from './SongBackingTrack'
import type { Recording } from '../types'

const rec = (samples: Array<[noteIdx: number, qualityIdx: number, dt: number]>): Recording => ({
  samples: samples.map(([noteIdx, qualityIdx, dt]) => ({ dt, noteIdx, qualityIdx, vibe: 0 })),
  totalMs: samples.reduce((s, [, , dt]) => s + dt, 0),
})

describe('backingSequence', () => {
  it('merges consecutive samples on the same degree into one chord', () => {
    const recording = rec([[0, 0, 100], [0, 0, 100], [4, 0, 100]])
    const seq = backingSequence(recording, { keyOffset: 0, scale: 'major' })
    expect(seq).toHaveLength(2)
    expect(seq[0].durationMs).toBe(200)
    expect(seq[1].durationMs).toBe(100)
  })

  it('drops roots two octaves below the wheel register', () => {
    const seq = backingSequence(rec([[0, 0, 100]]), { keyOffset: 0, scale: 'major' })
    // Wheel tonic is C4 (midi 60) → bass C2 (midi 36)
    expect(seq[0].rootMidi).toBe(36)
  })

  it('follows the lesson key and scale', () => {
    // Degree 0 in E minor (keyOffset 4) → E, bass midi 60+4-24 = 40
    const seq = backingSequence(rec([[0, 0, 100]]), { keyOffset: 4, scale: 'minor' })
    expect(seq[0].rootMidi).toBe(40)
  })

  it('splits on quality changes so the pad voicing follows the extension', () => {
    const recording = rec([[0, 0, 100], [0, 2, 100]])
    const seq = backingSequence(recording, { keyOffset: 0, scale: 'major' })
    expect(seq).toHaveLength(2)
    expect(seq[0].rootMidi).toBe(seq[1].rootMidi)
    expect(seq[1].voicing.length).toBeGreaterThan(seq[0].voicing.length) // 7th adds a note
  })

  it('carries the chord voicing an octave below the wheel register', () => {
    const seq = backingSequence(rec([[0, 0, 100]]), { keyOffset: 0, scale: 'major' })
    // C major triad at octave -1: C3 E3 G3
    expect(seq[0].voicing).toEqual([48, 52, 55])
  })
})
