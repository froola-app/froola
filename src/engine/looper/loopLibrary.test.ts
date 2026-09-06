import { describe, it, expect, beforeEach } from 'vitest'
import { listLoops, saveLoop, deleteLoop } from './loopLibrary'
import type { SavedLoop } from './ChordLooper'

describe('loopLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trip: save then list', () => {
    const loop: SavedLoop = {
      name: 'Test Loop',
      bpm: 120,
      beatsPerSlot: 4,
      slots: [],
      savedAt: Date.now(),
    }

    saveLoop(loop)
    const loops = listLoops()

    expect(loops).toHaveLength(1)
    expect(loops[0]).toEqual(loop)
  })

  it('upsert replaces same-name loop', () => {
    const loop1: SavedLoop = {
      name: 'My Loop',
      bpm: 120,
      beatsPerSlot: 4,
      slots: [],
      savedAt: 1000,
    }

    const loop2: SavedLoop = {
      name: 'My Loop',
      bpm: 140,
      beatsPerSlot: 2,
      slots: [],
      savedAt: 2000,
    }

    saveLoop(loop1)
    saveLoop(loop2)
    const loops = listLoops()

    expect(loops).toHaveLength(1)
    expect(loops[0]).toEqual(loop2)
  })

  it('delete removes loop', () => {
    const loop1: SavedLoop = {
      name: 'Loop 1',
      bpm: 120,
      beatsPerSlot: 4,
      slots: [],
      savedAt: 1000,
    }

    const loop2: SavedLoop = {
      name: 'Loop 2',
      bpm: 140,
      beatsPerSlot: 2,
      slots: [],
      savedAt: 2000,
    }

    saveLoop(loop1)
    saveLoop(loop2)
    deleteLoop('Loop 1')
    const loops = listLoops()

    expect(loops).toHaveLength(1)
    expect(loops[0]).toEqual(loop2)
  })

  it('corrupted JSON returns []', () => {
    localStorage.setItem('froola.loops', 'not valid json {{{')
    const loops = listLoops()

    expect(loops).toEqual([])
  })
})
