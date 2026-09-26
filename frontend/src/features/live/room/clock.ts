/**
 * The server's clock, from the browser's. Everyone in a live lesson plays each
 * clip at the server time it was given, so each browser needs to know how far
 * its own clock is from the server's. Pure: tested without a network.
 */

export interface Sample {
  /** Browser time (ms) when the request left, and when the answer came back. */
  sent: number
  received: number
  /** Server time (s) in the answer. */
  server: number
}

/**
 * Seconds to add to the browser's clock to get the server's. The sample with
 * the shortest round trip is the most trustworthy; the server's reading is
 * assumed to be from the middle of it.
 */
export function offsetFrom(samples: Sample[]): number {
  if (samples.length === 0) return 0
  const best = samples.reduce((a, b) => (b.received - b.sent < a.received - a.sent ? b : a))
  const middle = (best.sent + best.received) / 2 / 1000
  return best.server - middle
}

/** Where a clip should start on the audio clock, and how far into it (for a latecomer). */
export function placement(
  clipStart: number,
  clipDuration: number,
  serverNow: number,
  audioNow: number,
): { at: number; offset: number } | null {
  const wait = clipStart - serverNow
  if (wait >= 0) return { at: audioNow + wait, offset: 0 }
  const into = -wait
  // Joining in the last moment of a sentence: skip it rather than blurt a word.
  if (into >= clipDuration - 0.15) return null
  return { at: audioNow, offset: into }
}
