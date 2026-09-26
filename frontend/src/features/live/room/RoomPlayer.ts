/**
 * Playing a live lesson in step with everyone else: each clip starts at the
 * server time the conductor gave it, on this browser's audio clock. A clip
 * announced ahead (`prefetch`) is fetched and decoded before its turn.
 */
import { loudness } from '../audio/timing'
import { placement } from './clock'

export class RoomPlayer {
  readonly ctx: AudioContext
  private readonly analyser: AnalyserNode
  private readonly samples: Float32Array<ArrayBuffer>
  private readonly buffers = new Map<string, Promise<AudioBuffer>>()
  private readonly sources = new Set<AudioBufferSourceNode>()

  constructor(
    private readonly clipUrl: (key: string) => string,
    private readonly serverNow: () => number,
  ) {
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.samples = new Float32Array(this.analyser.fftSize)
    this.analyser.connect(this.ctx.destination)
  }

  async unlock(): Promise<void> {
    await this.ctx.resume()
  }

  prefetch(key: string): void {
    if (this.buffers.has(key)) return
    const loading = fetch(this.clipUrl(key))
      .then((r) => {
        if (!r.ok) throw new Error(`clip ${r.status}`)
        return r.arrayBuffer()
      })
      .then((bytes) => this.ctx.decodeAudioData(bytes))
    loading.catch(() => this.buffers.delete(key))
    this.buffers.set(key, loading)
    // Keep the cache small: a lesson is hundreds of clips.
    if (this.buffers.size > 40) {
      const oldest = this.buffers.keys().next().value
      if (oldest && oldest !== key) this.buffers.delete(oldest)
    }
  }

  /** Play a clip at its server time. Returns where it lands on the audio clock, or null if skipped. */
  async play(key: string, start: number, duration: number): Promise<number | null> {
    this.prefetch(key)
    let buffer: AudioBuffer
    try {
      buffer = await this.buffers.get(key)!
    } catch {
      return null
    }
    const where = placement(start, duration, this.serverNow(), this.ctx.currentTime)
    if (!where) return null
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.analyser)
    source.start(where.at, where.offset)
    this.sources.add(source)
    source.onended = () => this.sources.delete(source)
    return where.at - where.offset
  }

  /** How loud the voice is right now, 0…1 — what moves Astra's mouth. */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.samples)
    return loudness(this.samples)
  }

  close(): void {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear()
    void this.ctx.close().catch(() => undefined)
  }
}
