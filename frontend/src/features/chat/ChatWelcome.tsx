/**
 * The new-chat screen. A student meets their buddy and a handful of questions
 * they can tap to get going; a teacher gets the studio — the box in the
 * middle, a few ideas, and everything that can be made.
 */
import { AnimatePresence, motion } from 'motion/react'
import {
  Atom,
  BookOpenText,
  Calculator,
  ChalkboardTeacher,
  Globe,
  Lightbulb,
  ListChecks,
  Megaphone,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { LogoMark } from '@/brand/Logo'
import { Buddy, BuddyStage, greeting, profileOf } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { pop, rise, spring, stagger, useCalmMotion } from '@/motion'

interface Starter {
  Icon: Icon
  tone: string
  text: string
  /** Shorter, for a chip; the whole `text` is what is sent. */
  label?: string
}

const FOR_STUDENTS: Starter[] = [
  { Icon: Atom, tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', text: 'Why is the sky blue?' },
  { Icon: Calculator, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', text: 'Help me practise my times tables' },
  { Icon: BookOpenText, tone: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', text: 'Tell me a fun fact about Malaysian history' },
  { Icon: Globe, tone: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100', text: 'How do volcanoes work?' },
  { Icon: Lightbulb, tone: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100', text: 'Explain fractions with pizza' },
  { Icon: Atom, tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', text: 'What do plants need to grow?' },
]

const FOR_TEACHERS: Starter[] = [
  { Icon: ChalkboardTeacher, tone: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100', label: 'Plan a fractions lesson', text: 'Plan a 40-minute Year 4 lesson on fractions' },
  { Icon: ListChecks, tone: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', label: 'Ways to check understanding', text: 'Give me three ways to check understanding of the water cycle' },
  { Icon: Lightbulb, tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', label: 'Differentiate a reading task', text: 'Differentiate a reading task for three levels' },
  { Icon: Megaphone, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', label: 'A note to parents', text: 'Write a short note to parents about Sports Day' },
]

/** What the headline says can be made, each in its own colour. */
const MAKES = [
  { word: 'quiz', tone: 'text-kind-quiz' },
  { word: 'study guide', tone: 'text-kind-study-guide' },
  { word: 'poster', tone: 'text-kind-poster' },
  { word: 'lesson plan', tone: 'text-primary' },
  { word: 'slide deck', tone: 'text-kind-slides' },
  { word: 'game', tone: 'text-kind-games' },
] as const
const TURN_MS = 2400

export function ChatWelcome({
  onPick,
  composer,
  children,
}: {
  onPick: (text: string) => void
  /** The box itself, for the studio: in the middle of the page, not the foot. */
  composer?: React.ReactNode
  children?: React.ReactNode
}) {
  const { user } = useAuth()
  const student = user?.role === 'student'
  // A different four each visit, so the screen never feels like wallpaper.
  const starters = useMemo(() => (student ? shuffle(FOR_STUDENTS).slice(0, 4) : FOR_TEACHERS), [student])
  const name = user ? firstName(user) : 'friend'

  if (!student) return <Studio name={name} starters={starters} onPick={onPick} composer={composer}>{children}</Studio>

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-6 md:py-10">
      <div className="w-full max-w-[var(--message-column)]">
        <BuddyStage buddy={user?.buddy} className="flex flex-col items-center px-4 pt-20 pb-5 text-center">
          <Buddy buddy={user?.buddy} size={150} bubble="top" />
          <p className="mt-1 font-display text-lg font-semibold text-muted-foreground">{greeting()}, {name}!</p>
          <h1 className="font-celebrate text-3xl md:text-4xl">What shall we find out, {profileOf(user?.buddy).name} and you?</h1>
        </BuddyStage>
        <motion.ul className="mt-6 grid gap-3 sm:grid-cols-2" variants={stagger(0.06, 0.2)} initial="hidden" animate="shown">
          {starters.map((starter) => (
            <motion.li key={starter.text} variants={pop}>
              <motion.button
                type="button"
                onClick={() => onPick(starter.text)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left font-bold shadow-sm transition-colors hover:border-hover-border"
              >
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', starter.tone)}>
                  <starter.Icon weight="duotone" className="size-6" />
                </span>
                {starter.text}
              </motion.button>
            </motion.li>
          ))}
        </motion.ul>
        {children && <div className="mt-8 space-y-6">{children}</div>}
      </div>
    </div>
  )
}

/**
 * The studio's front page: a greeting, a headline that keeps changing its
 * mind about what to make, the box in the middle, a few ideas as chips, and
 * then everything that can be made — with room to breathe.
 */
function Studio({
  name,
  starters,
  onPick,
  composer,
  children,
}: {
  name: string
  starters: Starter[]
  onPick: (text: string) => void
  composer?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-12 pt-[max(2rem,6vh)]">
        <motion.span initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy} className="grid size-14 place-items-center rounded-3xl bg-grape-100 shadow-lg dark:bg-grape-800/40">
          <LogoMark twinkle className="size-9" />
        </motion.span>
        <p className="mt-4 font-display text-lg font-semibold text-muted-foreground">
          {greeting()}, {name}!
        </p>
        <h1 className="mt-1 text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
          Let's make a <Turning />
        </h1>
        <p className="mt-2 text-center text-muted-foreground">Ask anything below — or pick something to create.</p>

        {composer && <div className="mt-7 w-full max-w-3xl">{composer}</div>}

        <motion.ul className="mt-4 flex w-full max-w-3xl flex-wrap justify-center gap-2" variants={stagger(0.05, 0.25)} initial="hidden" animate="shown" aria-label="Ideas to start with">
          {starters.map((starter) => (
            <motion.li key={starter.text} variants={rise}>
              <motion.button
                type="button"
                onClick={() => onPick(starter.text)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                title={starter.text}
                className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-surface py-1.5 pl-1.5 pr-4 text-sm font-bold shadow-sm transition-colors hover:border-hover-border"
              >
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', starter.tone)}>
                  <starter.Icon weight="duotone" className="size-4" aria-hidden />
                </span>
                {starter.label ?? starter.text}
              </motion.button>
            </motion.li>
          ))}
        </motion.ul>

        {children && <div className="mt-12 w-full">{children}</div>}
      </div>
    </div>
  )
}

/** The thing to make, changing every couple of seconds. */
function Turning() {
  const calm = useCalmMotion()
  const [at, setAt] = useState(0)
  useEffect(() => {
    if (calm) return
    const timer = window.setInterval(() => setAt((n) => (n + 1) % MAKES.length), TURN_MS)
    return () => window.clearInterval(timer)
  }, [calm])
  const make = MAKES[at]
  return (
    // Clipped to its own line, so the word rising in or out never crosses
    // the greeting above it.
    <span className="relative inline-flex overflow-hidden pb-[0.12em] align-bottom">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={make.word}
          className={cn('inline-block whitespace-nowrap', make.tone)}
          initial={{ y: '0.45em', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-0.45em', opacity: 0, filter: 'blur(6px)', transition: { duration: 0.18 } }}
          transition={spring.gentle}
        >
          {make.word}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only">, a quiz, a study guide, a poster and more</span>
    </span>
  )
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}
