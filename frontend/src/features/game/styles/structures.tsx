/**
 * What Match & Build builds in each world (§23) — a rope bridge, a
 * glass-bottom boat, a wau kite, a light-rail track, a rocket — one piece per
 * challenge, so a game of nine builds it in nine. A piece placed right shines
 * in the world's colour; one that was missed still goes in, plainer, so the
 * build is always finished by the end. The piece being played glows.
 */
import { motion } from 'motion/react'
import type { GameWorld } from '@/features/learning/api'
import { paint } from '../worlds/info'

/** Per piece: placed right, placed after a miss, or not placed yet. */
export type Piece = 'right' | 'missed' | null

interface StructureProps {
  world: GameWorld
  pieces: Piece[]
  current: number
  calm: boolean
  /** The game is won: the build sets off. */
  finished?: boolean
}

type Shape = (i: number, total: number) => string

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A plank of the rope bridge, hung along the curve between two trees. */
const plank: Shape = (i, total) => {
  const w = 300 / total
  const x = 50 + i * w
  const sag = (x2: number) => 140 + 50 * Math.sin(Math.PI * ((x2 - 50) / 300))
  const y1 = sag(x)
  const y2 = sag(x + w - 4)
  return `M${x} ${y1} L${x + w - 4} ${y2} L${x + w - 4} ${y2 + 16} L${x} ${y1 + 16} Z`
}

/** A strake of the boat's hull, from the keel up. */
const strake: Shape = (i, total) => {
  const band = 110 / total
  const yBottom = 230 - i * band
  const yTop = yBottom - band + 2
  const edge = (y: number) => lerp(70, 120, (y - 120) / 110)
  return `M${edge(yTop)} ${yTop} L${400 - edge(yTop)} ${yTop} L${400 - edge(yBottom)} ${yBottom} L${edge(yBottom)} ${yBottom} Z`
}

/** A slice of the wau's diamond, around its centre. */
const slice: Shape = (i, total) => {
  const corners = [
    [200, 30],
    [330, 140],
    [200, 270],
    [70, 140],
  ]
  const point = (t: number) => {
    const at = (t * 4) % 4
    const k = Math.floor(at)
    const [ax, ay] = corners[k]
    const [bx, by] = corners[(k + 1) % 4]
    return [lerp(ax, bx, at - k), lerp(ay, by, at - k)]
  }
  const steps = 6
  const edge = Array.from({ length: steps + 1 }, (_, s) => point((i + s / steps) / total))
  return `M200 140 ${edge.map(([x, y]) => `L${x} ${y}`).join(' ')} Z`
}

/** A span of the light-rail track, rising across the city. */
const span: Shape = (i, total) => {
  const at = (t: number) => [lerp(30, 370, t), 210 - 90 * Math.sin((t * Math.PI) / 2)]
  const [x1, y1] = at(i / total)
  const [x2, y2] = at((i + 1) / total)
  return `M${x1} ${y1} L${x2 - 3} ${y2} L${x2 - 3} ${y2 + 14} L${x1} ${y1 + 14} Z M${(x1 + x2) / 2 - 4} ${(y1 + y2) / 2 + 14} h8 V 270 h-8 Z`
}

/** A section of the rocket, from the engine up to the nose cone. */
const section: Shape = (i, total) => {
  const band = 200 / total
  const yBottom = 250 - i * band
  const yTop = yBottom - band + 2
  if (i === total - 1) return `M150 ${yBottom} L250 ${yBottom} L200 ${yTop - 20} Z`
  const half = (y: number) => lerp(55, 50, (250 - y) / 200)
  return `M${200 - half(yTop)} ${yTop} L${200 + half(yTop)} ${yTop} L${200 + half(yBottom)} ${yBottom} L${200 - half(yBottom)} ${yBottom} Z`
}

const SHAPES: Record<GameWorld, Shape> = { rainforest: plank, reef: strake, kampung: slice, city: span, space: section }

function Setting({ world }: { world: GameWorld }) {
  if (world === 'rainforest') {
    return (
      <g>
        <rect x="20" y="70" width="30" height="230" rx="10" fill={paint(world, 'near')} />
        <rect x="350" y="70" width="30" height="230" rx="10" fill={paint(world, 'near')} />
        <path d="M35 120 Q 200 230 365 120" fill="none" stroke={paint(world, 'ground')} strokeWidth="5" />
      </g>
    )
  }
  if (world === 'reef') return <path d="M40 120 Q 200 100 360 120" fill="none" stroke={paint(world, 'glow')} strokeWidth="4" strokeDasharray="10 8" />
  if (world === 'kampung') return <line x1="200" y1="270" x2="120" y2="300" stroke={paint(world, 'mid')} strokeWidth="3" />
  if (world === 'city') return <rect x="20" y="268" width="360" height="8" rx="4" fill={paint(world, 'ground')} />
  return (
    <g fill={paint(world, 'near')}>
      <path d="M145 250 L120 290 L150 270 Z M255 250 L280 290 L250 270 Z" />
    </g>
  )
}

export function Structure({ world, pieces, current, calm, finished = false }: StructureProps) {
  const shape = SHAPES[world]
  const total = Math.max(pieces.length, 1)
  return (
    <motion.svg
      viewBox="0 0 400 300"
      className="h-full max-h-[20vh] min-h-[120px] w-full sm:max-h-[32vh] sm:min-h-[180px]"
      role="img"
      aria-label={`${pieces.filter(Boolean).length} of ${pieces.length} pieces built`}
      animate={finished && !calm ? (world === 'space' ? { y: [0, -400] } : { y: [0, -10, 0], rotate: [0, -2, 2, 0] }) : undefined}
      transition={finished ? (world === 'space' ? { duration: 2.4, ease: 'easeIn', delay: 0.6 } : { duration: 1.6, repeat: Infinity }) : undefined}
    >
      <Setting world={world} />
      {pieces.map((piece, i) => (
        <path
          key={i}
          d={shape(i, total)}
          fill={piece === 'right' ? paint(world, 'accent') : piece === 'missed' ? 'hsl(var(--muted-foreground) / 0.55)' : i === current ? 'hsl(var(--star) / 0.45)' : 'hsl(var(--surface) / 0.6)'}
          stroke={i === current && !piece ? 'hsl(var(--star))' : piece ? 'hsl(var(--foreground) / 0.55)' : 'hsl(var(--foreground) / 0.35)'}
          strokeWidth={i === current && !piece ? 4 : 2}
          strokeDasharray={piece ? undefined : '6 5'}
        >
          {i === current && !piece && !calm && <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />}
        </path>
      ))}
      {finished && world === 'space' && !calm && (
        <motion.ellipse cx="200" cy="270" rx="40" ry="20" fill="hsl(var(--star))" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ duration: 0.4, repeat: Infinity }} />
      )}
    </motion.svg>
  )
}
