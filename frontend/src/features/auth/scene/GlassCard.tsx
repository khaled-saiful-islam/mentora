import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'

/** Degrees of lean at the card's edge — enough to feel, not to read askew. */
const LEAN = 4

/**
 * Frosted glass the form sits on. It leans a little toward the pointer and
 * a soft light follows it across the surface, like a card held up to a lamp.
 */
export function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const calm = useCalmMotion()
  const tiltX = useSpring(0, { stiffness: 140, damping: 18 })
  const tiltY = useSpring(0, { stiffness: 140, damping: 18 })
  const lightX = useMotionValue(50)
  const lightY = useMotionValue(30)
  const light = useMotionTemplate`radial-gradient(520px circle at ${lightX}% ${lightY}%, color-mix(in oklab, var(--color-white) 16%, transparent), transparent 45%)`

  function follow(event: React.PointerEvent<HTMLDivElement>) {
    if (calm || event.pointerType !== 'mouse') return
    const box = event.currentTarget.getBoundingClientRect()
    const across = (event.clientX - box.left) / box.width
    const down = (event.clientY - box.top) / box.height
    tiltY.set((across - 0.5) * LEAN * 2)
    tiltX.set((0.5 - down) * LEAN * 2)
    lightX.set(across * 100)
    lightY.set(down * 100)
  }

  function rest() {
    tiltX.set(0)
    tiltY.set(0)
  }

  return (
    <div className={cn('[perspective:1400px]', className)}>
      <motion.div
        onPointerMove={follow}
        onPointerLeave={rest}
        style={{ rotateX: tiltX, rotateY: tiltY }}
        className="relative overflow-hidden rounded-[2rem] bg-surface/90 p-7 text-foreground shadow-2xl ring-1 ring-white/40 backdrop-blur-2xl sm:p-9"
      >
        <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: light }} />
        <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        <div className="relative">{children}</div>
      </motion.div>
    </div>
  )
}
