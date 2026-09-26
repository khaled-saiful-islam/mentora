/**
 * The arithmetic of speaking: when the next clip starts, and when each word of
 * a clip is said. Pure, so the parts that decide whether the tutor sounds
 * human can be tested without a sound card.
 */

/**
 * Seconds of silence after a clip, by name — the same as the server's
 * (`live/beats.py`). Each sentence is its own clip, and the `sentence` gap
 * after it is where a calm storyteller's pace comes from.
 */
export const PAUSE_SECONDS = { join: 0.12, sentence: 0.45, short: 0.35, breath: 0.8, think: 1.8 } as const
export type Silence = keyof typeof PAUSE_SECONDS

/** How far ahead of "now" a clip is scheduled, so it never starts late with a click. */
export const LEAD_SECONDS = 0.06

/**
 * When the next clip should start: right after the one before it and its
 * pause, never in the past. Scheduling on the audio clock rather than on
 * `ended` events is what makes it gapless — the silence is the script's.
 */
export function nextStart(now: number, previous: { end: number; pause: Silence } | null): number {
  const earliest = now + LEAD_SECONDS
  if (!previous) return earliest
  return Math.max(earliest, previous.end + PAUSE_SECONDS[previous.pause])
}

export interface TimedWord {
  word: string
  start: number
  end: number
}

// Punctuation takes time to say too: a comma is a small breath, a full stop a longer one.
const COMMA_WEIGHT = 0.8
const STOP_WEIGHT = 1.4
// Voices start a clip with a little silence and trail off at the end.
const LEAD_IN = 0.04
const TRAIL_OFF = 0.12

/** Roughly how many syllables a written word has. Good enough to pace a caption. */
export function syllables(word: string): number {
  const letters = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!letters) return 0
  if (/^\d+$/.test(letters)) return Math.max(1, letters.length)
  const groups = letters.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups?.length ?? 1)
}

/**
 * When each word of `text` is heard in a clip `duration` seconds long.
 *
 * The voice gives no timings, so they are estimated: time is shared out by
 * syllables, with punctuation taking its share of pause. Within one beat of a
 * few sentences that stays close enough for the highlight to feel attached to
 * the voice; every beat starts from its own clip, so it never drifts further.
 */
export function wordTimings(text: string, duration: number): TimedWord[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0 || duration <= 0) return []
  const weights = words.map((word) => {
    const pause = /[.!?…]["')]*$/.test(word) ? STOP_WEIGHT : /[,;:—–-]["')]*$/.test(word) ? COMMA_WEIGHT : 0
    return { say: Math.max(1, syllables(word)), pause }
  })
  const total = weights.reduce((sum, w) => sum + w.say + w.pause, 0)
  const speaking = Math.max(0.1, duration - LEAD_IN - TRAIL_OFF)
  const unit = speaking / total
  let at = LEAD_IN
  return words.map((word, i) => {
    const start = at
    const end = start + weights[i].say * unit
    at = end + weights[i].pause * unit
    return { word, start: round(start), end: round(end) }
  })
}

/** Which word is being said `elapsed` seconds into the clip; -1 before the first. */
export function wordAt(timings: TimedWord[], elapsed: number): number {
  let low = 0
  let high = timings.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (timings[mid].start <= elapsed) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

/** A loudness 0…1 from time-domain samples: what drives the tutor's mouth. */
export function loudness(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  const rms = Math.sqrt(sum / samples.length)
  // Speech sits around 0.05–0.25 RMS; spread that across the mouth's range.
  return Math.min(1, Math.max(0, (rms - 0.012) * 5))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
