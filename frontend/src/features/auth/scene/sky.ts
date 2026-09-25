/**
 * Where the stars go — the same sky on every visit.
 *
 * Seeded rather than random: a sky that rearranges itself on every render
 * flickers, and one that differs between the server's idea and the browser's
 * is a hydration bug waiting to happen. Pure, so it can be tested.
 */

export interface Star {
  /** Across, 0–100 (%). */
  x: number
  /** Down, 0–100 (%) of the sky, kept to the upper part so none sit on the hills. */
  y: number
  /** Diameter in pixels. */
  size: number
  /** Seconds for one twinkle, and how far into it the star starts. */
  period: number
  delay: number
}

/** A tiny, fast, deterministic generator (mulberry32). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function starField(count: number, seed = 7, ceiling = 62): Star[] {
  const next = seeded(seed)
  return Array.from({ length: count }, () => ({
    x: round(next() * 100),
    y: round(next() * ceiling),
    // Mostly small, a few bright ones.
    size: next() > 0.85 ? 3 : next() > 0.5 ? 2 : 1.5,
    period: round(2.2 + next() * 3.6),
    delay: round(next() * 4),
  }))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
