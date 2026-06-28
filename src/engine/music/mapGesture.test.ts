import { describe, it, expect } from 'vitest'
import { createMapper } from './mapGesture'
import type { GestureSignal } from '../types'

function sig(x: number, y: number): GestureSignal {
  return { x, y, present: true, handId: 'left' }
}

describe('createMapper — snap zones', () => {
  it('zone 0 (x=0.1) → Cmaj', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.5))?.chord).toBe('Cmaj')
  })
  it('zone 1 (x=0.375) → Fmaj', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))                         // prime zone 0
    expect(map(sig(0.375, 0.5))?.chord).toBe('Fmaj')
  })
  it('zone 2 (x=0.625) → Gmaj', () => {
    const map = createMapper('warm')
    expect(map(sig(0.625, 0.5))?.chord).toBe('Gmaj')
  })
  it('zone 3 (x=1.0) → Cmaj (tonic wrap)', () => {
    const map = createMapper('warm')
    map(sig(0.625, 0.5))                       // prime zone 2
    expect(map(sig(1.0, 0.5))?.chord).toBe('Cmaj')
  })
  it('x=0.25 (exact boundary) falls into zone 1', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))                         // prime zone 0
    expect(map(sig(0.25, 0.5))?.chord).toBe('Fmaj')
  })
})

describe('createMapper — threshold', () => {
  it('returns null when position stays in same zone and register is unchanged', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))                         // prime
    expect(map(sig(0.15, 0.5))).toBeNull()     // still zone 0, y unchanged
  })
  it('returns a command when zone changes', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))
    expect(map(sig(0.4, 0.5))).not.toBeNull()  // moved to zone 1
  })
  it('returns a command when register moves past half-semitone (>0.021 in y)', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))
    expect(map(sig(0.1, 0.522))).not.toBeNull() // 0.022 > threshold 0.021
  })
  it('returns null when register moves less than half-semitone (<0.021 in y)', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))
    expect(map(sig(0.1, 0.510))).toBeNull()    // 0.010 < threshold 0.021
  })
})

describe('createMapper — voicing', () => {
  it('returns 3 MIDI notes', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.5))?.voicing).toHaveLength(3)
  })
  it('at y=0.5 (middle) Cmaj root is MIDI 60', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.5))?.voicing[0]).toBe(60)
  })
  it('at y=0.0 (top) shifts voicing up 12 semitones', () => {
    const mapMid = createMapper('warm')
    const mapTop = createMapper('warm')
    const mid = mapMid(sig(0.1, 0.5))!
    const top = mapTop(sig(0.1, 0.0))!
    expect(top.voicing[0]).toBe(mid.voicing[0] + 12)
    expect(top.voicing[1]).toBe(mid.voicing[1] + 12)
    expect(top.voicing[2]).toBe(mid.voicing[2] + 12)
  })
  it('at y=1.0 (bottom) shifts voicing down 12 semitones', () => {
    const mapMid = createMapper('warm')
    const mapBot = createMapper('warm')
    const mid = mapMid(sig(0.1, 0.5))!
    const bot = mapBot(sig(0.1, 1.0))!
    expect(bot.voicing[0]).toBe(mid.voicing[0] - 12)
  })
})

describe('createMapper — tension', () => {
  it('tonic (zone 0) has tension 0.0', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.5))?.tension).toBe(0.0)
  })
  it('subdominant (zone 1) has tension 0.3', () => {
    const map = createMapper('warm')
    map(sig(0.1, 0.5))
    expect(map(sig(0.375, 0.5))?.tension).toBeCloseTo(0.3)
  })
  it('dominant (zone 2) has tension 0.6', () => {
    const map = createMapper('warm')
    expect(map(sig(0.625, 0.5))?.tension).toBeCloseTo(0.6)
  })
})

describe('createMapper — other fields', () => {
  it('register mirrors input y', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.3))?.register).toBeCloseTo(0.3)
  })
  it('texture is fixed at 0.5 in SP1', () => {
    const map = createMapper('warm')
    expect(map(sig(0.1, 0.5))?.texture).toBe(0.5)
  })
})
