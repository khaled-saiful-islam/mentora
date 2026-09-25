/**
 * Little things a buddy gives off: stars when it cheers, notes when it
 * dances, a "z" when it dozes. Each kind has a shape and a way of moving;
 * `emit` scatters a few from a point in the drawing and they clear
 * themselves away when their animation ends.
 */
import { motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { starPath } from './parts'
import { paint } from './paint'
import type { Point } from './types'

export type ParticleKind =
  | 'sparkle'
  | 'star'
  | 'heart'
  | 'note'
  | 'zzz'
  | 'sweat'
  | 'question'
  | 'confetti'
  | 'flame'
  | 'ring'
  | 'bolt'
  | 'leaf'
  | 'feather'
  | 'smoke'

interface Particle {
  id: number
  kind: ParticleKind
  from: Point
  x: number[]
  y: number[]
  rotate: number
  scale: number
  life: number
  delay: number
  tint: number
}

const MAX_PARTICLES = 48
const TINTS = ['var(--primary)', 'var(--star)', 'var(--correct)', 'var(--wrong)', 'var(--sky-400)']

const between = (low: number, high: number) => low + Math.random() * (high - low)

type Flight = Pick<Particle, 'x' | 'y' | 'rotate' | 'scale' | 'life' | 'delay'>

/** How each kind travels: offsets from where it starts, over its life. */
function flight(kind: ParticleKind, i: number, n: number): Flight {
  const angle = (i / n) * Math.PI * 2 + between(-0.3, 0.3)
  switch (kind) {
    case 'sparkle':
    case 'star':
    case 'bolt': {
      const reach = kind === 'bolt' ? between(24, 38) : between(40, 70)
      return {
        x: [0, Math.cos(angle) * reach],
        y: [0, Math.sin(angle) * reach],
        rotate: between(-90, 90),
        scale: between(0.8, 1.3),
        life: kind === 'bolt' ? 0.5 : 0.9,
        delay: i * 0.03,
      }
    }
    case 'heart':
      return { x: [0, between(-22, 22)], y: [0, between(-70, -50)], rotate: between(-20, 20), scale: between(0.8, 1.2), life: 1.4, delay: i * 0.12 }
    case 'note':
      return { x: [0, (i % 2 ? 1 : -1) * between(20, 36)], y: [0, -55], rotate: between(-25, 25), scale: between(0.9, 1.2), life: 1.6, delay: 0 }
    case 'zzz':
      return { x: [0, 10, 26], y: [0, -22, -44], rotate: 12, scale: between(0.9, 1.4), life: 2.2, delay: i * 0.5 }
    case 'sweat':
      return { x: [0, 5], y: [0, 18], rotate: 0, scale: 1, life: 0.9, delay: 0 }
    case 'question':
      return { x: [0, between(-8, 8)], y: [0, -20], rotate: between(-15, 15), scale: 1.1, life: 1.6, delay: i * 0.25 }
    case 'confetti':
      return {
        x: [between(-80, 80), between(-95, 95)],
        y: [between(-40, -10), 130],
        rotate: between(-540, 540),
        scale: between(0.8, 1.2),
        life: between(1.4, 2.2),
        delay: between(0, 0.3),
      }
    case 'flame':
      return { x: [0, between(46, 78)], y: [0, between(-16, 12)], rotate: between(-30, 30), scale: between(1, 1.6), life: 0.7, delay: i * 0.05 }
    case 'ring':
      return { x: [0, 0], y: [0, 0], rotate: 0, scale: 2.6, life: 0.85, delay: i * 0.16 }
    case 'leaf':
    case 'feather':
      return {
        x: [0, between(-30, 30), between(-44, 44)],
        y: [0, 30, 66],
        rotate: between(-200, 200),
        scale: between(0.8, 1.1),
        life: 1.9,
        delay: i * 0.1,
      }
    case 'smoke':
      return { x: [0, between(-6, 6)], y: [0, -26], rotate: 0, scale: 1.7, life: 1.1, delay: i * 0.12 }
  }
}

function Shape({ kind, tint }: { kind: ParticleKind; tint: number }) {
  switch (kind) {
    case 'sparkle':
      return <path d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z" fill="hsl(var(--star))" />
    case 'star':
      return <path d={starPath(0, 0, 7, 3)} fill="hsl(var(--star))" stroke="hsl(var(--sun-600))" strokeWidth={1} strokeLinejoin="round" />
    case 'heart':
      return <path d="M0 6 C-9 -1 -6 -9 0 -4.5 C6 -9 9 -1 0 6 Z" fill="hsl(var(--wrong))" />
    case 'note':
      return (
        <g fill="hsl(var(--primary))">
          <ellipse cx={-2} cy={5} rx={4} ry={3} transform="rotate(-20 -2 5)" />
          <path d="M1.5 4 L1.5 -8 L7 -6 L7 -3 L3.5 -4.2 L3.5 4 Z" />
        </g>
      )
    case 'zzz':
      return (
        <text textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={13} fill="hsl(var(--primary))">
          z
        </text>
      )
    case 'sweat':
      return <path d="M0 -6 Q5 1 3.2 4 Q0 7 -3.2 4 Q-5 1 0 -6 Z" fill="hsl(var(--sky-400))" />
    case 'question':
      return (
        <text textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={16} fill="hsl(var(--primary))">
          ?
        </text>
      )
    case 'confetti':
      return <rect x={-3} y={-1.8} width={6} height={3.6} rx={1} fill={`hsl(${TINTS[tint % TINTS.length]})`} />
    case 'flame':
      return <path d="M0 -7 Q6 0 4 4 Q0 8 -4 4 Q-6 0 0 -7 Z" fill={paint('momo-flame')} />
    case 'ring':
      return <circle r={9} fill="none" stroke="hsl(var(--star))" strokeWidth={2.4} />
    case 'bolt':
      return <path d="M1 -7 L-4 1 L0 1 L-1 7 L4 -1 L0 -1 Z" fill={paint('bolt-bulb')} />
    case 'leaf':
      return <path d="M-6 0 Q0 -6 6 0 Q0 6 -6 0 Z" fill={paint('kiko-leaf')} />
    case 'feather':
      return <path d="M0 -8 Q5 -2 0 8 Q-5 -2 0 -8 Z" fill={paint('ollie-belly')} stroke={paint('ollie')} strokeWidth={0.8} />
    case 'smoke':
      return <circle r={5} fill="hsl(var(--muted-foreground))" opacity={0.35} />
  }
}

const FADES: Partial<Record<ParticleKind, number[]>> = {
  ring: [0.9, 0.6, 0],
  smoke: [0.6, 0.4, 0],
}

function Bit({ particle, onDone }: { particle: Particle; onDone: (id: number) => void }) {
  const [ox, oy] = particle.from
  const { x, y, scale } = particle
  return (
    <motion.g
      initial={{ x: ox + x[0], y: oy + y[0], opacity: 0, scale: 0.3, rotate: 0 }}
      animate={{
        x: x.map((v) => ox + v),
        y: y.map((v) => oy + v),
        opacity: FADES[particle.kind] ?? [0, 1, 1, 0],
        scale: particle.kind === 'ring' ? [0.3, scale] : [0.3, scale, scale * 0.85],
        rotate: particle.rotate,
      }}
      transition={{ duration: particle.life, delay: particle.delay, ease: 'easeOut' }}
      onAnimationComplete={() => onDone(particle.id)}
      style={{ pointerEvents: 'none' }}
    >
      <Shape kind={particle.kind} tint={particle.tint} />
    </motion.g>
  )
}

export interface ParticleField {
  particles: Particle[]
  emit: (kind: ParticleKind, count: number, from: Point) => void
  clear: (id: number) => void
}

export function useParticles(enabled: boolean): ParticleField {
  const [particles, setParticles] = useState<Particle[]>([])
  const next = useRef(0)

  const emit = useCallback(
    (kind: ParticleKind, count: number, from: Point) => {
      if (!enabled) return
      const born = Array.from({ length: count }, (_, i) => ({
        id: next.current++,
        kind,
        from,
        tint: Math.floor(Math.random() * TINTS.length),
        ...flight(kind, i, count),
      }))
      setParticles((live) => [...live, ...born].slice(-MAX_PARTICLES))
    },
    [enabled],
  )

  const clear = useCallback((id: number) => {
    setParticles((live) => live.filter((p) => p.id !== id))
  }, [])

  return { particles, emit, clear }
}

export function Particles({ field }: { field: ParticleField }) {
  return (
    <g aria-hidden>
      {field.particles.map((particle) => (
        <Bit key={particle.id} particle={particle} onDone={field.clear} />
      ))}
    </g>
  )
}
