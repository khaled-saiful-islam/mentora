/**
 * A burst of confetti in Mentora's colours. Never under reduced motion —
 * callers pass `calm` from useCalmMotion(), and the library's own switch is on
 * too as a second line.
 */
import confetti from 'canvas-confetti'

const COLOURS = ['#6D4AFF', '#FFC23D', '#18B98A', '#FF6B6B', '#3AA0FF', '#FF7A1A']

export function celebrate({ calm, power = 1, origin = { x: 0.5, y: 0.6 } }: { calm: boolean; power?: number; origin?: { x: number; y: number } }) {
  if (calm) return
  const count = Math.round(90 * power)
  const shared = { colors: COLOURS, disableForReducedMotion: true, zIndex: 70, origin }
  void confetti({ ...shared, particleCount: count, spread: 70, startVelocity: 45, scalar: 1.05 })
  window.setTimeout(() => {
    void confetti({ ...shared, particleCount: Math.round(count / 2), spread: 110, startVelocity: 30, scalar: 0.9, ticks: 180 })
  }, 180)
}
