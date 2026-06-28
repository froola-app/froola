declare module 'soundfont-player' {
  interface Player {
    play(note: string | number, when?: number, options?: { gain?: number; duration?: number; loop?: boolean }): { stop(when?: number): void }
    stop(when?: number): void
  }
  interface SoundfontStatic {
    instrument(ctx: AudioContext, name: string, options?: {
      destination?: AudioNode
      gain?: number
      format?: string
      soundfont?: string
    }): Promise<Player>
  }
  const Soundfont: SoundfontStatic
  export default Soundfont
}
