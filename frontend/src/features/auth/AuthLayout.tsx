import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { LogoTile } from '@/brand/Logo'
import { spring } from '@/motion'
import { AuthScene } from './scene/AuthScene'
import { BuddyCrew } from './scene/BuddyCrew'
import { CrewProvider } from './scene/crew'
import { GlassCard } from './scene/GlassCard'
import { Taglines } from './scene/Taglines'

export const TAGLINES = [
  'Quizzes that cheer you on.',
  'Flashcards that flip.',
  'Badges worth showing off.',
  'A study buddy in your pocket.',
  'Results that show what to practise next.',
] as const

/** The warm, glowing part of a headline. */
export function Glow({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-sun-300 via-coral-100 to-sky-100 bg-clip-text text-transparent">
      {children}
    </span>
  )
}

/**
 * Every signed-out screen: a dusk sky over hills where the five buddies
 * stand watching, a headline with lines typing themselves out, and the form
 * on a sheet of frosted glass. The buddies react to the form — see `crew.tsx`.
 */
export function AuthLayout({
  title = (
    <>
      Where teachers and students <Glow>learn together.</Glow>
    </>
  ),
  taglines = TAGLINES,
  greeting,
  children,
}: {
  title?: React.ReactNode
  taglines?: readonly string[]
  /** Said by a buddy once they have all landed. */
  greeting?: string
  children: React.ReactNode
}) {
  return (
    <CrewProvider>
      <div className="relative isolate min-h-dvh overflow-hidden bg-grape-900 text-white">
        <AuthScene />
        <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:px-10">
          <section className="flex flex-col px-5 pt-6 sm:px-8 lg:px-0 lg:pt-10">
            <Link to="/" className="inline-flex items-center gap-3 self-start" aria-label="Mentora home">
              <LogoTile className="size-11 bg-white/15 from-white/25 to-white/5 ring-1 ring-white/30 backdrop-blur lg:size-12" />
              <span className="font-display text-2xl font-semibold tracking-tight lg:text-3xl">Mentora</span>
            </Link>

            <div className="mt-7 lg:mt-auto">
              <motion.p
                className="max-w-xl font-celebrate text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl"
                initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ ...spring.gentle, delay: 0.1 }}
              >
                {title}
              </motion.p>
              <Taglines lines={taglines} className="mt-4 font-display text-lg font-semibold text-white/85 lg:text-2xl" />
            </div>

            <div className="mt-6 lg:mt-auto lg:pb-[5vh]">
              <BuddyCrew greeting={greeting} />
              {/* On a phone the hills are far below, behind the form, so
                  the buddies get a hill of their own to stand on. */}
              <svg viewBox="0 0 400 36" preserveAspectRatio="none" aria-hidden className="-mt-3 h-9 w-full fill-grape-800 lg:hidden">
                <path d="M0 36 C 70 4 330 4 400 36 Z" />
              </svg>
            </div>
          </section>

          <main className="relative -mt-4 flex items-start justify-center px-4 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:px-0 lg:py-10">
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring.gentle, delay: 0.2 }}
            >
              <GlassCard>{children}</GlassCard>
            </motion.div>
          </main>
        </div>
      </div>
    </CrewProvider>
  )
}
