import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect } from 'react'
import {
  Atom,
  BookOpenText,
  Calculator,
  Globe,
  Lightbulb,
  MusicNotes,
  PencilSimple,
  Planet,
  Ruler,
  Star as StarIcon,
  type Icon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { starField } from './sky'

const STARS = starField(70, 11, 58)

interface Doodle {
  Icon: Icon
  x: string
  y: string
  size: number
  tone: string
  /** How far it drifts with the pointer: nearer things move more. */
  depth: number
  wide?: boolean
}

/** The things school is made of, floating in the sky at different depths. */
const DOODLES: Doodle[] = [
  // Kept to the edges and the gaps: never over the logo, the headline or the form.
  { Icon: StarIcon, x: '4%', y: '20%', size: 38, tone: 'text-sun-300', depth: 28, wide: true },
  { Icon: MusicNotes, x: '38%', y: '6%', size: 30, tone: 'text-coral-100', depth: 16, wide: true },
  { Icon: Atom, x: '88%', y: '8%', size: 50, tone: 'text-sky-100', depth: 34 },
  { Icon: Planet, x: '52%', y: '12%', size: 54, tone: 'text-grape-200', depth: 12, wide: true },
  { Icon: PencilSimple, x: '94%', y: '46%', size: 36, tone: 'text-coral-100', depth: 40, wide: true },
  { Icon: BookOpenText, x: '2%', y: '56%', size: 34, tone: 'text-grape-100', depth: 22, wide: true },
  { Icon: Calculator, x: '53%', y: '66%', size: 34, tone: 'text-mint-100', depth: 30, wide: true },
  { Icon: Lightbulb, x: '46%', y: '40%', size: 32, tone: 'text-sun-300', depth: 20, wide: true },
  { Icon: Globe, x: '70%', y: '5%', size: 30, tone: 'text-sky-100', depth: 14 },
  { Icon: Ruler, x: '91%', y: '84%', size: 30, tone: 'text-sun-100', depth: 26, wide: true },
]

/**
 * The world behind every signed-out screen: a dusk sky over rolling hills,
 * with stars, a shooting star now and then, soft clouds, and the doodles of
 * a school day drifting at different depths as the pointer moves.
 */
export function AuthScene() {
  const calm = useCalmMotion()
  const pointer = usePointer(calm)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-grape-900 via-grape-700 to-grape-500" />
      <Layer pointer={pointer} depth={10} className="absolute inset-0">
        <span className="blob -left-24 top-[8%] size-[26rem] bg-coral-400 opacity-40" />
        <span className="blob right-[-6rem] top-[-4rem] size-[30rem] bg-sky-400 opacity-35 [animation-delay:-7s]" />
        <span className="blob bottom-[18%] left-[30%] size-[28rem] bg-sun-400 opacity-30 [animation-delay:-12s]" />
      </Layer>

      <Layer pointer={pointer} depth={5} className="absolute inset-0">
        {STARS.map((star, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
            animate={calm ? { opacity: 0.7 } : { opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
            transition={calm ? { duration: 0 } : { duration: star.period, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </Layer>

      {!calm && <ShootingStar />}
      <Clouds calm={calm} />

      {DOODLES.map((doodle, i) => (
        <Layer
          key={i}
          pointer={pointer}
          depth={doodle.depth}
          className={cn('absolute', doodle.wide && 'hidden lg:block')}
          style={{ left: doodle.x, top: doodle.y }}
        >
          <motion.span
            className={cn('block opacity-80', doodle.tone)}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={
              calm
                ? { opacity: 0.8, scale: 1 }
                : { opacity: 0.8, scale: 1, y: [0, -12, 0], rotate: [0, i % 2 ? 12 : -12, 0] }
            }
            transition={
              calm
                ? { duration: 0.2 }
                : {
                    opacity: { delay: 0.3 + i * 0.08, duration: 0.5 },
                    scale: { delay: 0.3 + i * 0.08, ...spring.bouncy },
                    y: { duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut' },
                    rotate: { duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          >
            <doodle.Icon weight="duotone" size={doodle.size} />
          </motion.span>
        </Layer>
      ))}

      <Hills pointer={pointer} />
    </div>
  )
}

type Pointer = { x: MotionValue<number>; y: MotionValue<number> }

/** Where the pointer is, -1 … 1 across and down the window, as springs. */
function usePointer(calm: boolean): Pointer {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, { stiffness: 60, damping: 20 })
  const y = useSpring(rawY, { stiffness: 60, damping: 20 })

  useEffect(() => {
    if (calm) return
    const move = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1)
      rawY.set((event.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [calm, rawX, rawY])

  return { x, y }
}

/** Moves against the pointer by its depth, which is what reads as distance. */
function Layer({
  pointer,
  depth,
  className,
  style,
  children,
}: {
  pointer: Pointer
  depth: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const x = useTransform(pointer.x, (v) => v * -depth)
  const y = useTransform(pointer.y, (v) => v * -depth * 0.6)
  return (
    <motion.div className={className} style={{ ...style, x, y }}>
      {children}
    </motion.div>
  )
}

/** Every so often, a streak across the top of the sky. */
function ShootingStar() {
  return (
    <motion.span
      className="absolute left-[12%] top-[10%] h-0.5 w-32 origin-left rounded-full bg-gradient-to-r from-white to-transparent"
      style={{ rotate: 18 }}
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{ opacity: [0, 1, 0], x: [0, 420], y: [0, 140] }}
      transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 6.5, delay: 2.5, ease: 'easeOut' }}
    />
  )
}

/** Soft clouds crossing slowly, far behind everything else. */
function Clouds({ calm }: { calm: boolean }) {
  return (
    <>
      {[
        { top: '18%', width: 220, duration: 70, delay: -10, opacity: 0.14 },
        { top: '34%', width: 300, duration: 95, delay: -50, opacity: 0.1 },
        { top: '8%', width: 160, duration: 60, delay: -32, opacity: 0.12 },
      ].map((cloud, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 200 60"
          className="absolute fill-white"
          style={{ top: cloud.top, width: cloud.width, opacity: cloud.opacity }}
          initial={{ x: '-30vw' }}
          animate={calm ? { x: `${20 + i * 30}vw` } : { x: ['-30vw', '110vw'] }}
          transition={calm ? { duration: 0 } : { duration: cloud.duration, delay: cloud.delay, repeat: Infinity, ease: 'linear' }}
        >
          <path d="M30 50 C5 50 5 25 28 25 C30 8 58 4 70 18 C80 2 115 4 118 25 C140 18 160 30 150 50 Z" />
        </motion.svg>
      ))}
    </>
  )
}

/** Two layers of hill; the nearer moves more as the pointer does. */
function Hills({ pointer }: { pointer: Pointer }) {
  const far = useTransform(pointer.x, (v) => v * -8)
  const near = useTransform(pointer.x, (v) => v * -16)
  return (
    <div className="absolute inset-x-[-4%] bottom-0 h-[34vh] min-h-48">
      <motion.svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute inset-0 size-full fill-grape-600/70" style={{ x: far }}>
        <path d="M0 150 C 200 60 380 90 560 140 C 760 195 900 70 1120 90 C 1280 105 1360 150 1440 130 L1440 320 L0 320 Z" />
      </motion.svg>
      <motion.svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute inset-0 size-full fill-grape-800" style={{ x: near }}>
        <path d="M0 230 C 180 170 360 175 520 215 C 700 260 860 180 1060 190 C 1240 200 1340 240 1440 225 L1440 320 L0 320 Z" />
      </motion.svg>
    </div>
  )
}
