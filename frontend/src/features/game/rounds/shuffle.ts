/**
 * Shuffling a round's pieces (§26). A round takes its shuffle as a prop, so a
 * test can pass one that is not random; everyone else gets a real one.
 */

export type Shuffler = <T>(items: readonly T[]) => T[]

/** A round that can be given its own shuffle. */
export interface Shuffled {
  shuffle?: Shuffler
}

/** Fisher–Yates, on a copy. */
export const shuffled: Shuffler = <T>(items: readonly T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Shuffled, and never in the order given: a line that is already in order,
 *  or pairs already side by side, are no puzzle. */
export function outOfOrder<T>(items: readonly T[], shuffle: Shuffler): T[] {
  const out = shuffle(items)
  if (items.length < 2 || out.some((item, n) => item !== items[n])) return out
  return [...out.slice(1), out[0]]
}
