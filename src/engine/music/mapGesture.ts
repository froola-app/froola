import type { GestureSignal, MusicalCommand } from '../types'
import { WARM_MAJOR } from './scales'
import type { ChordSlot } from './scales'

const VIBES: Record<string, ChordSlot[]> = { warm: WARM_MAJOR }

// y range 0..1 spans 24 semitones (-12 to +12).
// Half-semitone threshold = 0.5 / 24
const REGISTER_THRESHOLD = 0.5 / 24

function registerOffset(y: number): number {
  return Math.round((0.5 - y) * 24)
}

export function createMapper(
  vibe: string
): (signal: GestureSignal) => MusicalCommand | null {
  const slots = VIBES[vibe] ?? WARM_MAJOR
  let lastZone = -1
  let lastY = -1

  return function map(signal: GestureSignal): MusicalCommand | null {
    const zone = Math.min(3, Math.floor(signal.x * 4))
    const zoneChanged = zone !== lastZone
    const registerChanged = Math.abs(signal.y - lastY) > REGISTER_THRESHOLD

    if (!zoneChanged && !registerChanged) return null

    lastZone = zone
    lastY = signal.y

    const slot = slots[zone]
    const offset = registerOffset(signal.y)
    const voicing = slot.intervals.map(interval => slot.rootMidi + interval + offset)

    return {
      chord: slot.name,
      voicing,
      register: signal.y,
      texture: 0.5,
      tension: slot.tension,
    }
  }
}
