/**
 * The pieces worlds are drawn with: layers that slide past, things that sway,
 * drift and twinkle. Each moves only when `live` — calm motion keeps a world
 * still (`Backdrop`).
 */
import type { WorldPart } from './info'

export interface ArtProps {
  /** A colour of this world. */
  p: (part: WorldPart, alpha?: number) => string
  random: () => number
  live: boolean
  run: boolean
}

/** A layer that slides past, endlessly, while running: its content drawn
 *  twice side by side and moved one width along. */
export function Sliding({ run, seconds, children }: { run: boolean; seconds: number; children: React.ReactNode }) {
  return (
    <g>
      <g>{children}</g>
      <g transform="translate(1600 0)">{children}</g>
      {run && <animateTransform attributeName="transform" type="translate" from="0 0" to="-1600 0" dur={`${seconds}s`} repeatCount="indefinite" />}
    </g>
  )
}

/** A gentle back-and-forth: leaves, lanterns, sea fans. */
export function Sway({ live, deg = 3, seconds = 4, x, y, children }: { live: boolean; deg?: number; seconds?: number; x: number; y: number; children: React.ReactNode }) {
  return (
    <g>
      {children}
      {live && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`${-deg} ${x} ${y}; ${deg} ${x} ${y}; ${-deg} ${x} ${y}`}
          dur={`${seconds}s`}
          repeatCount="indefinite"
        />
      )}
    </g>
  )
}

/** Things drifting up or down through the scene — bubbles, leaves, sparks. */
export function Drift({ live, count, random, from, to, render }: {
  live: boolean
  count: number
  random: () => number
  from: number
  to: number
  render: (x: number, size: number) => React.ReactNode
}) {
  if (!live) return null
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = random() * 1600
        const size = 0.6 + random() * 0.8
        const seconds = 9 + random() * 9
        const delay = -random() * seconds
        return (
          <g key={i} opacity="0.85">
            <g transform={`translate(${x} 0)`}>{render(x, size)}</g>
            <animateTransform attributeName="transform" type="translate" from={`0 ${from}`} to={`${(random() - 0.5) * 160} ${to}`} dur={`${seconds}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </g>
        )
      })}
    </g>
  )
}

/** A twinkle: a light that breathes in and out. */
export function Twinkle({ live, seconds, delay, children }: { live: boolean; seconds: number; delay: number; children: React.ReactNode }) {
  return (
    <g>
      {children}
      {live && <animate attributeName="opacity" values="1;0.25;1" dur={`${seconds}s`} begin={`${delay}s`} repeatCount="indefinite" />}
    </g>
  )
}
