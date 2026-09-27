/**
 * How each buddy sounds — made on the spot like the game's own blips
 * (`lib/sound.ts`), so there are no audio files to load. A chirp for a tap,
 * a happy trill for a cheer, a soft "aww" for a miss, and a babble under
 * every speech bubble — a syllable a word, in the buddy's own pitch — so a
 * child hears their buddy talking, the way a cartoon animal does.
 *
 * Only when the person has sound on, and never while idle: a buddy fidgets
 * quietly.
 */
import { audioContext } from '@/lib/audio'
import type { BuddyKey, Mood } from './types'

export type BuddySound = 'tap' | 'yay' | 'aww' | 'trill' | 'hello'

interface Tone {
  /** The middle of the buddy's voice, in Hz. */
  base: number
  wave: OscillatorType
  /** How far a syllable wanders from the middle, as a share of it. */
  spread: number
  /** Seconds a syllable. */
  step: number
  /** Square and saw waves are brighter, so they are played softer. */
  loud: number
}

export const TONES: Record<BuddyKey, Tone> = {
  kiko: { base: 760, wave: 'triangle', spread: 0.35, step: 0.075, loud: 0.12 },
  bolt: { base: 540, wave: 'square', spread: 0.5, step: 0.09, loud: 0.05 },
  ollie: { base: 340, wave: 'sine', spread: 0.2, step: 0.13, loud: 0.16 },
  momo: { base: 620, wave: 'sine', spread: 0.3, step: 0.085, loud: 0.14 },
  rimau: { base: 250, wave: 'sawtooth', spread: 0.25, step: 0.1, loud: 0.05 },
}

// [share of the base pitch, start in steps, length in steps]
type Shape = [number, number, number][]

const SHAPES: Record<BuddySound, Shape> = {
  tap: [[1.3, 0, 0.8]],
  hello: [
    [1, 0, 1],
    [1.5, 1, 1.4],
  ],
  yay: [
    [1, 0, 0.8],
    [1.26, 0.7, 0.8],
    [1.5, 1.4, 1.6],
  ],
  trill: [
    [1.2, 0, 0.5],
    [1.5, 0.4, 0.5],
    [1.2, 0.8, 0.5],
    [1.8, 1.2, 1],
  ],
  aww: [
    [1.1, 0, 1.4],
    [0.8, 1.2, 2.2],
  ],
}

/** The sound a mood makes when a buddy plays it for a reason. */
export const MOOD_SOUND: Partial<Record<Mood, BuddySound>> = {
  cheer: 'yay',
  celebrate: 'yay',
  clap: 'yay',
  happy: 'tap',
  oops: 'aww',
  wave: 'hello',
  hop: 'trill',
  bounce: 'trill',
  dance: 'trill',
  trick: 'trill',
}

/** How many syllables a line babbles: about one a word, two to nine. */
export function syllables(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length
  return Math.max(2, Math.min(9, words))
}

/** A pitch for each syllable, the same every time for the same line; a
 *  question or an exclamation lifts at the end. */
export function babblePitches(line: string, tone: Tone): number[] {
  let seed = [...line].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const next = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000
  const pitches = Array.from({ length: syllables(line) }, () => tone.base * (1 + tone.spread * (next() - 0.5)))
  if (/[?!]\s*$/.test(line)) pitches[pitches.length - 1] = tone.base * (1 + tone.spread)
  return pitches
}

function note(ctx: AudioContext, tone: Tone, frequency: number, start: number, length: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tone.wave
  osc.frequency.setValueAtTime(frequency, start)
  // A little slide makes a syllable sound spoken, not played.
  osc.frequency.linearRampToValueAtTime(frequency * 0.94, start + length)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(tone.loud, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + length + 0.03)
}

/** One of a buddy's sounds, `delay` seconds from now. */
export function playBuddySound(buddy: BuddyKey, sound: BuddySound, delay = 0): void {
  try {
    const ctx = audioContext()
    if (!ctx) return
    const tone = TONES[buddy]
    const at = ctx.currentTime + delay
    for (const [share, start, length] of SHAPES[sound]) {
      note(ctx, tone, tone.base * share, at + start * tone.step, length * tone.step)
    }
  } catch {
    // No audio here: a quiet buddy is still a buddy.
  }
}

/** The babble under a speech bubble. */
export function babble(buddy: BuddyKey, line: string, delay = 0): void {
  try {
    const ctx = audioContext()
    if (!ctx) return
    const tone = TONES[buddy]
    const at = ctx.currentTime + delay
    babblePitches(line, tone).forEach((pitch, i) => note(ctx, tone, pitch, at + i * tone.step * 1.25, tone.step))
  } catch {
    // As above.
  }
}
