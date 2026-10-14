/**
 * The sound of a mission (§28.3.2): a quiet, tense music bed under the
 * narrator — a low drone and a slow heartbeat, with a far-off note now and
 * then — and a sting for each moment: the phone ringing, a news flash, a
 * letter's seal, a postcard's whoosh, a comic's pow, an island coming into
 * view, the mission accepted, and the win.
 *
 * Made on the spot with Web Audio, like the game's blips, so there is
 * nothing to download. Kept quiet on purpose — it is played in classrooms —
 * and the bed ducks under the voice whenever it speaks.
 */
import { audioContext } from '@/lib/audio'

export type Sting = 'comic' | 'call' | 'letter' | 'news' | 'postcard' | 'island' | 'accept' | 'win'

// Loudness, as gain: the bed well under a voice, a sting under a blip.
export const LEVEL = { music: 0.075, ducked: 0.025, sting: 0.14 } as const

// A heartbeat a little under resting pace: tense, not frantic.
const BEAT_MS = 920
// Every so many beats, a far-off note from a minor chord.
const NOTE_EVERY = 4
const FAR_NOTES = [440, 523.25, 659.25, 587.33]

type Wave = OscillatorType

function tone(ctx: AudioContext, out: AudioNode, frequency: number, at: number, length: number, { wave = 'sine' as Wave, peak = 1, to }: { wave?: Wave; peak?: number; to?: number } = {}) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(frequency, at)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, length / 4))
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + length + 0.05)
}

function noise(ctx: AudioContext, out: AudioNode, at: number, length: number, { peak = 1, from = 800, to = 800, kind = 'bandpass' as BiquadFilterType } = {}) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * length)), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = kind
  filter.frequency.setValueAtTime(from, at)
  filter.frequency.exponentialRampToValueAtTime(to, at + length)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(filter).connect(gain).connect(out)
  source.start(at)
  source.stop(at + length + 0.05)
}

/** A short sting, once. Says nothing where there is no sound to be had. */
export function playSting(kind: Sting): void {
  try {
    const ctx = audioContext()
    if (!ctx) return
    const out = ctx.createGain()
    out.gain.value = LEVEL.sting
    out.connect(ctx.destination)
    STINGS[kind](ctx, out, ctx.currentTime + 0.02)
  } catch {
    // No sound here: the mission goes on in silence.
  }
}

const STINGS: Record<Sting, (ctx: AudioContext, out: AudioNode, t: number) => void> = {
  // Ring-ring, ring-ring: the two tones of a phone, twice.
  call: (ctx, out, t) => {
    for (const start of [0, 0.55, 1.6, 2.15]) {
      tone(ctx, out, 440, t + start, 0.4, { peak: 0.5 })
      tone(ctx, out, 480, t + start, 0.4, { peak: 0.5 })
    }
  },
  // Breaking news: three rising notes, then the chord, over a swish.
  news: (ctx, out, t) => {
    noise(ctx, out, t, 0.5, { peak: 0.25, from: 400, to: 3000 })
    ;[392, 523.25, 659.25].forEach((f, n) => tone(ctx, out, f, t + 0.1 + n * 0.13, 0.16, { wave: 'square', peak: 0.35 }))
    for (const f of [523.25, 659.25, 783.99]) tone(ctx, out, f, t + 0.5, 1.1, { wave: 'triangle', peak: 0.5 })
  },
  // The seal pops, and a chime.
  letter: (ctx, out, t) => {
    noise(ctx, out, t, 0.05, { peak: 0.8, from: 2500, to: 1500, kind: 'highpass' })
    tone(ctx, out, 880, t + 0.12, 1.4, { peak: 0.5 })
    tone(ctx, out, 1318.5, t + 0.2, 1.2, { peak: 0.3 })
  },
  // A whoosh across the sky, then a chime.
  postcard: (ctx, out, t) => {
    noise(ctx, out, t, 0.7, { peak: 0.5, from: 300, to: 2400 })
    tone(ctx, out, 783.99, t + 0.6, 1.2, { peak: 0.45 })
  },
  // Pow! A thump and a bright two-note shout.
  comic: (ctx, out, t) => {
    noise(ctx, out, t, 0.15, { peak: 0.7, from: 1200, to: 300, kind: 'lowpass' })
    tone(ctx, out, 400, t, 0.3, { peak: 0.8, to: 80 })
    tone(ctx, out, 659.25, t + 0.25, 0.25, { wave: 'triangle', peak: 0.5 })
    tone(ctx, out, 987.77, t + 0.45, 0.5, { wave: 'triangle', peak: 0.5 })
  },
  // An island coming into view: a rising sweep and a low thud.
  island: (ctx, out, t) => {
    tone(ctx, out, 220, t, 0.8, { wave: 'triangle', peak: 0.45, to: 660 })
    tone(ctx, out, 70, t + 0.75, 0.4, { peak: 0.8, to: 45 })
  },
  // The stamp comes down, and the chord swells: mission accepted.
  accept: (ctx, out, t) => {
    tone(ctx, out, 95, t, 0.25, { peak: 1, to: 40 })
    noise(ctx, out, t, 0.08, { peak: 0.6, from: 900, to: 400, kind: 'lowpass' })
    for (const f of [261.63, 329.63, 392, 523.25]) tone(ctx, out, f, t + 0.15, 1.3, { wave: 'triangle', peak: 0.4 })
  },
  // The win: up the chord, and hold.
  win: (ctx, out, t) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, n) => tone(ctx, out, f, t + n * 0.12, 0.3, { wave: 'triangle', peak: 0.45 }))
    for (const f of [523.25, 659.25, 783.99]) tone(ctx, out, f, t + 0.5, 1.6, { wave: 'triangle', peak: 0.4 })
  },
}

/**
 * The music bed: started on the mission's first tap, quiet, ducked under the
 * voice, faded out at the end. One at a time; starting twice is starting once.
 */
export class MissionScore {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private drones: OscillatorNode[] = []
  private timer = 0
  private beats = 0
  private speaking = false

  get playing(): boolean {
    return this.bus !== null
  }

  start(): void {
    if (this.bus) return
    try {
      const ctx = audioContext()
      if (!ctx) return
      this.ctx = ctx
      const bus = ctx.createGain()
      bus.gain.setValueAtTime(0.0001, ctx.currentTime)
      bus.gain.exponentialRampToValueAtTime(this.speaking ? LEVEL.ducked : LEVEL.music, ctx.currentTime + 2.5)
      bus.connect(ctx.destination)
      this.bus = bus
      // The drone: a low fifth, warmed and dulled.
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 380
      filter.connect(bus)
      this.drones = [55, 82.4, 110.3].map((f, n) => {
        const osc = ctx.createOscillator()
        osc.type = n === 2 ? 'sine' : 'triangle'
        osc.frequency.value = f
        osc.detune.value = n * 4
        osc.connect(filter)
        osc.start()
        return osc
      })
      this.timer = window.setInterval(() => this.beat(), BEAT_MS)
    } catch {
      this.stop()
    }
  }

  /** Quieter while the narrator speaks, back up when they stop. */
  duck(speaking: boolean): void {
    this.speaking = speaking
    if (!this.ctx || !this.bus) return
    this.bus.gain.setTargetAtTime(speaking ? LEVEL.ducked : LEVEL.music, this.ctx.currentTime, 0.3)
  }

  stop(): void {
    window.clearInterval(this.timer)
    const { ctx, bus, drones } = this
    this.bus = null
    this.drones = []
    if (!ctx || !bus) return
    try {
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4)
      for (const osc of drones) osc.stop(ctx.currentTime + 1.6)
    } catch {
      // Already gone.
    }
  }

  private beat(): void {
    const { ctx, bus } = this
    if (!ctx || !bus) return
    const t = ctx.currentTime + 0.02
    // The heartbeat: lub-dub.
    tone(ctx, bus, 62, t, 0.22, { peak: 0.9, to: 40 })
    tone(ctx, bus, 58, t + 0.24, 0.18, { peak: 0.55, to: 38 })
    this.beats += 1
    if (this.beats % NOTE_EVERY === 0) {
      tone(ctx, bus, FAR_NOTES[(this.beats / NOTE_EVERY) % FAR_NOTES.length], t + 0.4, 2.2, { peak: 0.18 })
    }
  }
}
