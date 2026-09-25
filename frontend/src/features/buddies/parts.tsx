/**
 * The parts every buddy's face is made of: eyes that blink and follow, a
 * mouth that morphs between shapes, cheeks that blush. Each rig places them
 * on its own head, so five different faces share one kind of life.
 */
import { AnimatePresence, motion, useTransform } from 'motion/react'
import { BLUSH, INK, pivot, SHINE, TONGUE } from './paint'
import type { Gaze, Mood } from './types'

// --- mouths ---------------------------------------------------------------

export type MouthShape = 'smile' | 'grin' | 'o' | 'yawn' | 'flat' | 'wobble' | 'roar'

// [half-width scale, upper lip, lower lip, corner drop]
const MOUTHS: Record<MouthShape, readonly [number, number, number, number]> = {
  smile: [1, 1.5, 7, -1],
  grin: [1.05, 0, 13, -2],
  o: [0.42, -4.5, 6.5, 0],
  yawn: [0.56, -8, 12, 0],
  flat: [0.8, 0.5, 2.2, 0],
  wobble: [0.75, 4, -1.5, 2.5],
  roar: [1.3, -8, 20, -2],
}

/**
 * A mouth as one closed shape: an upper lip and a lower lip, each a single
 * curve. Every shape uses the same commands, which is what lets the path
 * morph smoothly from a smile to a grin to a surprised "o".
 */
export function mouthPath(shape: MouthShape, cx: number, cy: number, width: number): string {
  const w = width / 2
  const [scale, up, down, drop] = MOUTHS[shape]
  const left = cx - w * scale
  const right = cx + w * scale
  const y = cy + drop
  const pull = w * scale * 0.42
  return (
    `M ${left} ${y} ` +
    `C ${left + pull} ${cy + up} ${right - pull} ${cy + up} ${right} ${y} ` +
    `C ${right - pull} ${cy + down} ${left + pull} ${cy + down} ${left} ${y} Z`
  )
}

export const MOUTH_FOR: Record<Mood, MouthShape> = {
  idle: 'smile',
  happy: 'grin',
  cheer: 'grin',
  oops: 'wobble',
  think: 'flat',
  dance: 'grin',
  celebrate: 'grin',
  sleepy: 'o',
  wave: 'grin',
  trick: 'grin',
  listen: 'smile',
  yawn: 'yawn',
  shy: 'flat',
  peek: 'o',
}

const OPEN: ReadonlySet<MouthShape> = new Set(['grin', 'roar', 'yawn'])

export function Mouth({
  shape,
  cx,
  cy,
  width,
  fill = INK,
  tongue = TONGUE,
}: {
  shape: MouthShape
  cx: number
  cy: number
  width: number
  fill?: string
  tongue?: string | null
}) {
  const open = OPEN.has(shape) && tongue !== null
  const big = shape === 'roar' || shape === 'yawn'
  return (
    <g>
      <motion.path
        initial={false}
        animate={{ d: mouthPath(shape, cx, cy, width) }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        fill={fill}
        stroke={fill}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <AnimatePresence>
        {open && (
          <motion.ellipse
            key="tongue"
            cx={cx}
            cy={cy + (big ? 12 : 8)}
            rx={width * (big ? 0.3 : 0.24)}
            ry={big ? 4.6 : 3.2}
            fill={tongue ?? undefined}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            style={pivot(cx, cy + 6)}
          />
        )}
      </AnimatePresence>
    </g>
  )
}

// --- eyes -----------------------------------------------------------------

export type EyeStyle = 'kawaii' | 'screen' | 'owl'
type EyeShape = 'open' | 'happy' | 'closed' | 'star' | 'dizzy'

export function eyeShapeFor(mood: Mood, side: 'left' | 'right'): EyeShape {
  switch (mood) {
    case 'happy':
    case 'cheer':
    case 'dance':
    case 'wave':
      return 'happy'
    case 'celebrate':
      return 'star'
    case 'sleepy':
    case 'yawn':
    case 'shy':
      return 'closed'
    case 'peek':
      return side === 'right' ? 'open' : 'closed'
    case 'oops':
      return 'dizzy'
    case 'trick':
      return side === 'right' ? 'happy' : 'open' // a wink
    default:
      return 'open'
  }
}

interface EyeLook {
  size: number
  style: EyeStyle
  colour: string
  iris: string
}

/**
 * A pair of eyes. Open eyes follow the gaze and blink; the other shapes are
 * drawn strokes. The catchlights stay put while the pupil moves, which is
 * what makes an eye read as glassy rather than painted on.
 */
export function Eyes({
  mood,
  gaze,
  blinking,
  left,
  right,
  size,
  style = 'kawaii',
  colour = INK,
  iris = INK,
}: {
  mood: Mood
  gaze: Gaze
  blinking: boolean
  left: readonly [number, number]
  right: readonly [number, number]
  size: number
  style?: EyeStyle
  colour?: string
  iris?: string
}) {
  const look: EyeLook = { size, style, colour, iris }
  return (
    <g>
      <Eye shape={eyeShapeFor(mood, 'left')} at={left} gaze={gaze} blinking={blinking} look={look} />
      <Eye shape={eyeShapeFor(mood, 'right')} at={right} gaze={gaze} blinking={blinking} look={look} />
    </g>
  )
}

const DRAWN = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 },
  transition: { type: 'spring', stiffness: 520, damping: 26 },
} as const

function Eye({
  shape,
  at,
  gaze,
  blinking,
  look,
}: {
  shape: EyeShape
  at: readonly [number, number]
  gaze: Gaze
  blinking: boolean
  look: EyeLook
}) {
  const [cx, cy] = at
  const s = look.size
  const stroke = {
    stroke: look.colour,
    strokeWidth: s * 0.34,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }
  const glow = look.style === 'screen' ? { filter: `drop-shadow(0 0 ${s * 0.4}px ${look.colour})` } : {}
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {shape === 'open' && (
        <motion.g key="open" {...DRAWN} style={pivot(cx, cy)}>
          <OpenEye cx={cx} cy={cy} gaze={gaze} blinking={blinking} look={look} />
        </motion.g>
      )}
      {shape === 'happy' && (
        <motion.path
          key="happy"
          {...DRAWN}
          style={{ ...pivot(cx, cy), ...glow }}
          d={`M ${cx - s * 0.75} ${cy + s * 0.25} Q ${cx} ${cy - s * 0.95} ${cx + s * 0.75} ${cy + s * 0.25}`}
          {...stroke}
        />
      )}
      {shape === 'closed' && (
        <motion.path
          key="closed"
          {...DRAWN}
          style={{ ...pivot(cx, cy), ...glow }}
          d={`M ${cx - s * 0.7} ${cy} Q ${cx} ${cy + s * 0.7} ${cx + s * 0.7} ${cy}`}
          {...stroke}
        />
      )}
      {shape === 'dizzy' && (
        <motion.path
          key="dizzy"
          {...DRAWN}
          style={{ ...pivot(cx, cy), ...glow }}
          d={`M ${cx - s * 0.5} ${cy - s * 0.5} L ${cx + s * 0.5} ${cy + s * 0.5} M ${cx + s * 0.5} ${cy - s * 0.5} L ${cx - s * 0.5} ${cy + s * 0.5}`}
          {...stroke}
        />
      )}
      {shape === 'star' && (
        <motion.path
          key="star"
          initial={{ opacity: 0, scale: 0.3, rotate: -40 }}
          animate={{ opacity: 1, scale: [1, 1.2, 1], rotate: 0 }}
          // Its own exit timing: the looping pulse would otherwise hold the
          // exit open forever and the star would never leave.
          exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.15 } }}
          transition={{ scale: { duration: 0.7, repeat: Infinity }, default: { type: 'spring', stiffness: 400, damping: 16 } }}
          style={pivot(cx, cy)}
          d={starPath(cx, cy, s * 1.1, s * 0.46)}
          fill="hsl(var(--star))"
          stroke="hsl(var(--sun-600))"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      )}
    </AnimatePresence>
  )
}

function OpenEye({
  cx,
  cy,
  gaze,
  blinking,
  look,
}: {
  cx: number
  cy: number
  gaze: Gaze
  blinking: boolean
  look: EyeLook
}) {
  const s = look.size
  const px = useTransform(gaze.x, (v) => v * s * (look.style === 'owl' ? 0.34 : 0.3))
  const py = useTransform(gaze.y, (v) => v * s * 0.24)
  const pupil =
    look.style === 'screen' ? (
      <rect
        x={cx - s * 0.5}
        y={cy - s * 0.85}
        width={s}
        height={s * 1.7}
        rx={s * 0.5}
        fill={look.colour}
        style={{ filter: `drop-shadow(0 0 ${s * 0.5}px ${look.colour})` }}
      />
    ) : (
      <ellipse
        cx={cx}
        cy={cy}
        rx={s * (look.style === 'owl' ? 0.6 : 0.82)}
        ry={s * (look.style === 'owl' ? 0.6 : 0.96)}
        fill={look.colour}
      />
    )
  return (
    <motion.g
      animate={{ scaleY: blinking ? 0.08 : 1 }}
      transition={{ duration: blinking ? 0.06 : 0.12 }}
      style={pivot(cx, cy)}
    >
      {look.style === 'owl' && (
        <>
          <circle cx={cx} cy={cy} r={s * 1.12} fill={SHINE} />
          <circle cx={cx} cy={cy} r={s * 0.98} fill={look.iris} />
        </>
      )}
      <motion.g style={{ x: px, y: py }}>
        {pupil}
        {look.style !== 'screen' && (
          <>
            <circle cx={cx - s * 0.28} cy={cy - s * 0.34} r={s * 0.3} fill={SHINE} />
            <circle cx={cx + s * 0.3} cy={cy + s * 0.28} r={s * 0.13} fill={SHINE} opacity={0.85} />
          </>
        )}
      </motion.g>
    </motion.g>
  )
}

export function starPath(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const step = Math.PI / points
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = i * step - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  })
  return `M ${corners.join(' L ')} Z`
}

// --- cheeks and gloss ------------------------------------------------------

const GLOWING: ReadonlySet<Mood> = new Set(['happy', 'cheer', 'celebrate', 'dance', 'trick', 'wave', 'oops'])

export function Cheeks({
  mood,
  left,
  right,
  rx,
  colour = BLUSH,
}: {
  mood: Mood
  left: readonly [number, number]
  right: readonly [number, number]
  rx: number
  colour?: string
}) {
  const glowing = GLOWING.has(mood)
  return (
    <g>
      {[left, right].map(([cx, cy]) => (
        <motion.ellipse
          key={cx}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={rx * 0.62}
          fill={colour}
          initial={false}
          animate={{ opacity: glowing ? 0.85 : 0.45, scale: glowing ? 1.15 : 1 }}
          style={pivot(cx, cy)}
        />
      ))}
    </g>
  )
}

/** The follow-through that makes a head feel attached to a neck: it drifts a
 *  little toward where the eyes are looking. */
export function Follow({
  gaze,
  x = 3,
  y = 2,
  children,
}: {
  gaze: Gaze
  x?: number
  y?: number
  children: React.ReactNode
}) {
  const tx = useTransform(gaze.x, (v) => v * x)
  const ty = useTransform(gaze.y, (v) => v * y)
  return <motion.g style={{ x: tx, y: ty }}>{children}</motion.g>
}

/** A soft highlight — the gloss on a round surface. */
export function Gloss({ cx, cy, rx, ry, rotate = -24 }: { cx: number; cy: number; rx: number; ry: number; rotate?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={SHINE} opacity={0.32} transform={`rotate(${rotate} ${cx} ${cy})`} />
}
