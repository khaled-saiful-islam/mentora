import { motion } from 'motion/react'
import {
  Atom,
  BookOpenText,
  Calculator,
  Globe,
  Lightbulb,
  MusicNotes,
  PencilSimple,
  Star,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { LogoTile } from '@/brand/Logo'
import { spring, useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'

/** The things school is made of, drifting about the edges of the welcome —
 *  never over the words, which sit in the middle-left. */
const DOODLES = [
  { Icon: Star, desktopOnly: true, x: '7%', y: '9%', size: 40, tone: 'text-sun-400', delay: 0 },
  { Icon: MusicNotes, x: '44%', y: '5%', size: 32, tone: 'text-coral-100', delay: 0.4 },
  { Icon: Atom, x: '82%', y: '11%', size: 52, tone: 'text-sky-100', delay: 0.6 },
  { Icon: PencilSimple, desktopOnly: true, x: '88%', y: '46%', size: 40, tone: 'text-coral-100', delay: 1.1 },
  { Icon: BookOpenText, desktopOnly: true, x: '84%', y: '74%', size: 36, tone: 'text-grape-100', delay: 1.8 },
  { Icon: Calculator, x: '66%', y: '89%', size: 40, tone: 'text-mint-100', delay: 0.3 },
  { Icon: Lightbulb, x: '38%', y: '91%', size: 36, tone: 'text-sun-300', delay: 0.9 },
  { Icon: Globe, x: '9%', y: '89%', size: 34, tone: 'text-sky-100', delay: 1.4 },
] as const

function Doodles() {
  const calm = useCalmMotion()
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {DOODLES.map(({ Icon, x, y, size, tone, delay, ...rest }, i) => (
        <motion.span
          key={i}
          // On a phone the words fill the hero; these would sit on them.
          className={cn('absolute', tone, 'desktopOnly' in rest && 'hidden lg:block')}
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={
            calm
              ? { opacity: 0.9, scale: 1 }
              : { opacity: 0.9, scale: 1, y: [0, -14, 0], rotate: [0, i % 2 ? 10 : -10, 0] }
          }
          transition={
            calm
              ? { duration: 0.2 }
              : {
                  opacity: { delay: 0.2 + delay * 0.3, duration: 0.4 },
                  scale: { delay: 0.2 + delay * 0.3, ...spring.bouncy },
                  y: { delay, duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut' },
                  rotate: { delay, duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut' },
                }
          }
        >
          <Icon weight="duotone" size={size} />
        </motion.span>
      ))}
    </div>
  )
}

/**
 * The welcome half of every signed-out screen: grape sky, drifting colour,
 * floating doodles, and the logo with its twinkling spark.
 */
function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="relative isolate flex min-h-[15rem] flex-col justify-end overflow-hidden bg-gradient-to-br from-grape-500 via-grape-600 to-grape-800 p-8 text-white lg:min-h-dvh lg:justify-center lg:p-14">
      <span className="blob -left-16 -top-10 size-72 bg-sun-400" />
      <span className="blob -bottom-24 right-0 size-80 bg-sky-400 [animation-delay:-6s]" />
      <span className="blob left-1/3 top-1/3 size-56 bg-coral-400 [animation-delay:-12s]" />
      <Doodles />

      <div className="relative">
        <Link to="/" className="inline-flex items-center gap-3" aria-label="Mentora home">
          <LogoTile className="size-12 bg-white/15 from-white/25 to-white/5 ring-1 ring-white/30 backdrop-blur" />
          <span className="font-display text-3xl font-semibold tracking-tight">Mentora</span>
        </Link>
        <motion.h2
          className="mt-6 max-w-md font-display text-3xl font-semibold leading-tight lg:mt-10 lg:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.1 }}
        >
          {title}
        </motion.h2>
        <motion.p
          className="mt-3 max-w-md text-base text-white/85 lg:text-lg"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.2 }}
        >
          {subtitle}
        </motion.p>
      </div>
    </section>
  )
}

export function AuthLayout({
  heroTitle = 'Where teachers and students learn together.',
  heroSubtitle = 'Quizzes and flashcards made from real sources, a study buddy that cheers you on, and results that show what to practise next.',
  children,
}: {
  heroTitle?: string
  heroSubtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <Hero title={heroTitle} subtitle={heroSubtitle} />
      <main className="flex items-start justify-center px-5 py-10 sm:px-8 lg:items-center">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.gentle}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
