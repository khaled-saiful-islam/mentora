/**
 * The tutor's mouth: clips in, one continuous voice out.
 *
 * Two lanes. The **lesson** lane is the recorded beats, and can be *held* —
 * a hand goes up, the beat being said finishes, and the next one waits. The
 * **tutor** lane is everything said to a person — "Yes, Aina?", an answer as
 * it streams in — and plays even while the lesson is held, always first.
 *
 * Each clip is scheduled on the audio clock the moment the one before it is
 * scheduled (one clip of look-ahead), so there is no gap between them but the
 * pause the script wrote. Nothing here knows what a lesson is.
 */
import { loudness, nextStart, type Silence } from './timing'

export type Lane = 'lesson' | 'tutor'

export interface Clip {
  id: string
  text: string
  lane: Lane
  /** Silence after this clip. */
  pause: Silence
  /** Started when the clip is queued, so it is usually decoded by its turn. */
  audio: Promise<AudioBuffer>
}

export interface Heard {
  clip: Clip
  /** On the audio clock (`AudioContext.currentTime`). */
  start: number
  duration: number
}

export interface QueueEvents {
  onStart?: (heard: Heard) => void
  onEnd?: (heard: Heard) => void
  /** Nothing playing and nothing that may play: the lesson is over, or held. */
  onIdle?: () => void
  onError?: (clip: Clip, error: unknown) => void
}

interface Slot extends Heard {
  source: AudioBufferSourceNode
  end: number
  timer: number
  cancelled: boolean
}

export class SpeechQueue {
  private readonly output: GainNode
  private readonly analyser: AnalyserNode
  private readonly samples: Float32Array<ArrayBuffer>
  private lanes: Record<Lane, Clip[]> = { lesson: [], tutor: [] }
  private slots: Slot[] = []
  private held = false
  private pumping = false
  private epoch = 0

  constructor(
    readonly ctx: AudioContext,
    private readonly events: QueueEvents = {},
  ) {
    this.output = ctx.createGain()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.samples = new Float32Array(this.analyser.fftSize)
    this.output.connect(this.analyser)
    this.analyser.connect(ctx.destination)
  }

  get isHeld(): boolean {
    return this.held
  }

  get isBusy(): boolean {
    return this.slots.length > 0 || this.lanes.tutor.length > 0 || (!this.held && this.lanes.lesson.length > 0)
  }

  now(): number {
    return this.ctx.currentTime
  }

  add(...clips: Clip[]): void {
    for (const clip of clips) this.lanes[clip.lane] = [...this.lanes[clip.lane], clip]
    void this.pump()
  }

  /** Let the beat being said finish; keep the rest of the lesson waiting. */
  hold(): void {
    this.held = true
    this.unscheduleAhead('lesson')
  }

  release(): void {
    this.held = false
    void this.pump()
  }

  /** Say something to someone next — ahead of any lesson beat not yet begun. */
  interject(...clips: Clip[]): void {
    this.unscheduleAhead('lesson')
    this.add(...clips)
  }

  clear(): void {
    this.epoch += 1
    this.lanes = { lesson: [], tutor: [] }
    for (const slot of this.slots) this.cancel(slot)
    this.slots = []
  }

  /** How loud the voice is right now, 0…1. */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.samples)
    return loudness(this.samples)
  }

  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      // The clip being heard, and one ready behind it.
      while (this.slots.length < 2) {
        const clip = this.lanes.tutor[0] ?? (this.held ? undefined : this.lanes.lesson[0])
        if (!clip) break
        const epoch = this.epoch
        let buffer: AudioBuffer
        try {
          buffer = await clip.audio
        } catch (error) {
          this.drop(clip)
          this.events.onError?.(clip, error)
          continue
        }
        // The world may have moved on while it decoded: cleared, held, or
        // something said first. Look again rather than play the wrong thing.
        if (epoch !== this.epoch) break
        const head = this.lanes.tutor[0] ?? (this.held ? undefined : this.lanes.lesson[0])
        if (head !== clip) continue
        this.drop(clip)
        this.schedule(clip, buffer)
      }
    } finally {
      this.pumping = false
    }
    if (this.slots.length === 0 && !this.isBusy) this.events.onIdle?.()
  }

  private schedule(clip: Clip, buffer: AudioBuffer): void {
    const tail = this.slots[this.slots.length - 1]
    const start = nextStart(this.ctx.currentTime, tail ? { end: tail.end, pause: tail.clip.pause } : null)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.output)
    source.start(start)
    const slot: Slot = {
      clip,
      source,
      start,
      duration: buffer.duration,
      end: start + buffer.duration,
      cancelled: false,
      timer: window.setTimeout(() => this.events.onStart?.(slot), Math.max(0, (start - this.ctx.currentTime) * 1000)),
    }
    source.onended = () => this.finished(slot)
    this.slots = [...this.slots, slot]
  }

  private finished(slot: Slot): void {
    if (slot.cancelled) return
    this.slots = this.slots.filter((s) => s !== slot)
    this.events.onEnd?.(slot)
    void this.pump()
  }

  /** Take back scheduled clips of a lane that have not started, to be said later. */
  private unscheduleAhead(lane: Lane): void {
    const now = this.ctx.currentTime
    const ahead = this.slots.filter((s) => s.clip.lane === lane && s.start > now + 0.01)
    if (ahead.length === 0) return
    for (const slot of ahead) this.cancel(slot)
    this.slots = this.slots.filter((s) => !ahead.includes(s))
    this.lanes[lane] = [...ahead.map((s) => s.clip), ...this.lanes[lane]]
  }

  private cancel(slot: Slot): void {
    slot.cancelled = true
    window.clearTimeout(slot.timer)
    try {
      slot.source.stop()
    } catch {
      // A source that never started throws on stop in some browsers; it is silent either way.
    }
    slot.source.disconnect()
  }

  private drop(clip: Clip): void {
    this.lanes[clip.lane] = this.lanes[clip.lane].filter((c) => c !== clip)
  }
}
