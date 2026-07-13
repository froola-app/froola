import type { SavedLoop } from './ChordLooper'

const KEY = 'froola.loops'

export function listLoops(): SavedLoop[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLoop(loop: SavedLoop): void {
  try {
    const rest = listLoops().filter(l => l.name !== loop.name)
    localStorage.setItem(KEY, JSON.stringify([...rest, loop]))
  } catch {
    /* storage full/blocked — loop just isn't persisted */
  }
}

export function deleteLoop(name: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listLoops().filter(l => l.name !== name)))
  } catch {
    /* ignore */
  }
}
