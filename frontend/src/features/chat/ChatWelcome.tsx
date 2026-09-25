/**
 * The new-chat screen. A student meets their buddy and a handful of questions
 * they can tap to get going; a teacher gets the studio and a few ways to
 * start on their planning.
 */
import { motion } from 'motion/react'
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
import { useMemo } from 'react'
import { LogoMark } from '@/brand/Logo'
import { Buddy, BuddyStage, greeting, profileOf } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { pop, rise, stagger } from '@/motion'

interface Starter {
  Icon: Icon
  tone: string
  text: string
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
  { Icon: ChalkboardTeacher, tone: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100', text: 'Plan a 40-minute Year 4 lesson on fractions' },
  { Icon: ListChecks, tone: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', text: 'Give me three ways to check understanding of the water cycle' },
  { Icon: Lightbulb, tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', text: 'Differentiate a reading task for three levels' },
  { Icon: Megaphone, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', text: 'Write a short note to parents about Sports Day' },
]

export function ChatWelcome({ onPick, children }: { onPick: (text: string) => void; children?: React.ReactNode }) {
  const { user } = useAuth()
  const student = user?.role === 'student'
  // A different four each visit, so the screen never feels like wallpaper.
  const starters = useMemo(() => (student ? shuffle(FOR_STUDENTS).slice(0, 4) : FOR_TEACHERS), [student])
  const name = user ? firstName(user) : 'friend'

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-6 md:py-10">
      <div className="w-full max-w-[var(--message-column)]">
        {student ? (
          <BuddyStage buddy={user?.buddy} className="flex flex-col items-center px-4 pt-20 pb-5 text-center">
            <Buddy buddy={user?.buddy} size={150} bubble="top" />
            <p className="mt-1 font-display text-lg font-semibold text-muted-foreground">{greeting()}, {name}!</p>
            <h1 className="font-celebrate text-3xl md:text-4xl">What shall we find out, {profileOf(user?.buddy).name} and you?</h1>
          </BuddyStage>
        ) : (
          <div className="flex flex-col items-center text-center">
            <motion.span initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="grid size-16 place-items-center rounded-3xl bg-grape-100 shadow-lg dark:bg-grape-800/40">
              <LogoMark twinkle className="size-10" />
            </motion.span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">What are we making today, {name}?</h1>
            <p className="mt-1 text-muted-foreground">Ask anything, or make something for your class.</p>
          </div>
        )}
        <motion.ul className="mt-6 grid gap-3 sm:grid-cols-2" variants={stagger(0.06, 0.2)} initial="hidden" animate="shown">
          {starters.map((starter) => (
            <motion.li key={starter.text} variants={student ? pop : rise}>
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

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}
