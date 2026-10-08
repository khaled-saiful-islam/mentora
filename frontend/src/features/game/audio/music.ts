/**
 * A game's music: a little loop for each world, made on the spot with Web
 * Audio — no files to load, nothing to license. A world has its own scale,
 * tempo and instruments (a marimba under the rainforest canopy, a gamelan for
 * the kampung, a synth for the city at night), and each game's tune is grown
 * from its own seed, so two rainforest games hum different songs.
 *
 * Quiet by design: music sits under the narration and the effects, and a
 * boss challenge only quickens it and adds a drum.
 */
import type { GameStyle, GameWorld } from '@/features/learning/api'

interface Voice {
  wave: OscillatorType
  /** Seconds to full volume, and to silence. */
  attack: number
  release: number
  gain: number
  /** A second oscillator this many cents away, for a fuller note. */
  detune?: number
}

interface Mood {
  tempo: number
  /** The lowest note of the scale, in Hz. */
  root: number
  /** Semitones above the root that the tune may use. */
  scale: number[]
  lead: Voice
  bass: Voice
  /** How often a step of the tune sounds, 0–1. */
  density: number
}

const PENTATONIC = [0, 2, 4, 7, 9]
const MOODS: Record<GameWorld, Mood> = {
  rainforest: { tempo: 100, root: 261.63, scale: PENTATONIC, density: 0.55,
    lead: { wave: 'triangle', attack: 0.005, release: 0.35, gain: 0.07 },
    bass: { wave: 'sine', attack: 0.01, release: 0.5, gain: 0.08 } },
  reef: { tempo: 84, root: 293.66, scale: [0, 2, 5, 7, 9], density: 0.4,
    lead: { wave: 'sine', attack: 0.02, release: 0.6, gain: 0.07, detune: 7 },
    bass: { wave: 'sine', attack: 0.04, release: 0.8, gain: 0.07 } },
  // Near enough to slendro for a gamelan's shimmer.
  kampung: { tempo: 96, root: 246.94, scale: [0, 2, 5, 7, 10], density: 0.6,
    lead: { wave: 'sine', attack: 0.002, release: 0.9, gain: 0.07, detune: 14 },
    bass: { wave: 'triangle', attack: 0.01, release: 0.6, gain: 0.07 } },
  city: { tempo: 112, root: 220, scale: [0, 3, 5, 7, 10], density: 0.6,
    lead: { wave: 'square', attack: 0.005, release: 0.18, gain: 0.035 },
    bass: { wave: 'sawtooth', attack: 0.01, release: 0.25, gain: 0.03 } },
  space: { tempo: 72, root: 196, scale: [0, 2, 4, 7, 11], density: 0.3,
    lead: { wave: 'sine', attack: 0.08, release: 1.4, gain: 0.06, detune: 5 },
    bass: { wave: 'sine', attack: 0.2, release: 1.6, gain: 0.06 } },
}

/** A runner runs: its music is quicker. */
const STYLE_TEMPO: Record<GameStyle, number> = { quest: 1, runner: 1.18, catch: 1.06, match: 1 }

const STEPS = 32 // two bars of sixteenths
const LOOKAHEAD_S = 0.12
const TICK_MS = 30

/** A small seeded random, so a game's tune is the same each time it plays. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return hash >>> 0
}

/** The tune: per step, a scale degree to play, or null for a rest. A walk
 *  that mostly moves by step, so it sings rather than jumps. */
export function compose(mood: Pick<Mood, 'scale' | 'density'>, seed: number): (number | null)[] {
  const random = seeded(seed)
  const span = mood.scale.length * 2
  let degree = Math.floor(random() * mood.scale.length)
  return Array.from({ length: STEPS }, (_, step) => {
    const onBeat = step % 4 === 0
    if (!onBeat && random() > mood.density) return null
    degree = Math.min(span - 1, Math.max(0, degree + Math.round((random() - 0.5) * 3)))
    // Each bar comes home to the root on its last beat.
    return step % 16 === 12 ? 0 : degree
  })
}

export function frequencyOf(mood: Pick<Mood, 'root' | 'scale'>, degree: number): number {
  const octave = Math.floor(degree / mood.scale.length)
  const semitones = mood.scale[degree % mood.scale.length] + 12 * octave
  return mood.root * 2 ** (semitones / 12)
}

export class Music {
  private master: GainNode | null = null
  private timer: number | null = null
  private step = 0
  private next = 0
  private boss = false
  private tune: (number | null)[] = []
  private mood: Mood = MOODS.rainforest
  private pace = 1

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  start(world: GameWorld, style: GameStyle, seed: number): void {
    this.stop(0)
    this.mood = MOODS[world]
    this.pace = STYLE_TEMPO[style]
    this.tune = compose(this.mood, seed)
    this.master = this.ctx.createGain()
    this.master.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    this.master.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 1.5)
    this.master.connect(this.out)
    this.step = 0
    this.next = this.ctx.currentTime + 0.1
    this.timer = window.setInterval(() => this.schedule(), TICK_MS)
  }

  setBoss(on: boolean): void {
    this.boss = on
  }

  stop(fade = 0.8): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    const master = this.master
    this.master = null
    if (!master) return
    const now = this.ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(fade, 0.01))
    window.setTimeout(() => master.disconnect(), (fade + 0.1) * 1000)
  }

  private get sixteenth(): number {
    return 60 / (this.mood.tempo * this.pace * (this.boss ? 1.12 : 1)) / 4
  }

  private schedule(): void {
    while (this.master && this.next < this.ctx.currentTime + LOOKAHEAD_S) {
      this.play(this.step, this.next)
      this.next += this.sixteenth
      this.step = (this.step + 1) % STEPS
    }
  }

  private play(step: number, at: number): void {
    const degree = this.tune[step]
    if (degree !== null && degree !== undefined) this.note(this.mood.lead, frequencyOf(this.mood, degree + this.mood.scale.length), at, this.sixteenth * 2)
    if (step % 8 === 0) {
      const root = step % 16 === 0 ? 0 : 3 // root, then the fifth
      this.note(this.mood.bass, frequencyOf(this.mood, root) / 2, at, this.sixteenth * 6)
    }
    if (this.boss && step % 4 === 0) this.drum(at, step % 8 === 0)
  }

  private note(voice: Voice, frequency: number, at: number, length: number): void {
    if (!this.master) return
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(voice.gain, at + voice.attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length + voice.release)
    gain.connect(this.master)
    for (const cents of voice.detune ? [-voice.detune, voice.detune] : [0]) {
      const osc = this.ctx.createOscillator()
      osc.type = voice.wave
      osc.frequency.setValueAtTime(frequency, at)
      osc.detune.setValueAtTime(cents, at)
      osc.connect(gain)
      osc.start(at)
      osc.stop(at + length + voice.release + 0.05)
    }
  }

  /** A soft kick on the beat and a lighter one between: a boss's heartbeat. */
  private drum(at: number, strong: boolean): void {
    if (!this.master) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.frequency.setValueAtTime(strong ? 110 : 90, at)
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.18)
    gain.gain.setValueAtTime(strong ? 0.16 : 0.08, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
    osc.connect(gain).connect(this.master)
    osc.start(at)
    osc.stop(at + 0.25)
  }
}
