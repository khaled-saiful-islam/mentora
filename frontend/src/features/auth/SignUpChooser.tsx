import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Trophy } from '@phosphor-icons/react'
import { Buddy, type BuddyHandle, type BuddyKey } from '@/features/buddies'
import { rise, stagger, useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import { AuthLayout, Glow } from './AuthLayout'

export default function SignUpChooser() {
  // An invite link lands here with its token; keep it on the student path.
  const [params] = useSearchParams()
  const invite = params.get('invite')
  const student = invite ? `/signup/student?invite=${encodeURIComponent(invite)}` : '/signup/student'

  return (
    <AuthLayout
      title={
        <>
          Let's get you <Glow>started!</Glow>
        </>
      }
      greeting="Ooh, a new friend! Who are you?"
    >
      <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-primary">Create an account</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Who's joining?</h1>
      <p className="mt-2 text-muted-foreground">Pick one — we'll set everything up just right.</p>

      <motion.ul className="mt-7 space-y-4" variants={stagger(0.1, 0.15)} initial="hidden" animate="shown">
        <motion.li variants={rise}>
          <StudentChoice to={student} />
        </motion.li>
        <motion.li variants={rise}>
          <TeacherChoice to="/signup/teacher" />
        </motion.li>
      </motion.ul>

      <p className="mt-7 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

const CARD = cn(
  'group relative flex min-h-36 overflow-hidden rounded-[1.75rem] p-5 shadow-press',
  'transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0',
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
)

function Go({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold', className)}>
      {label}
      <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-1" />
    </span>
  )
}

const PAIR: readonly BuddyKey[] = ['kiko', 'momo']

/** Two buddies peeking over the edge, who jump when you point at them. */
function StudentChoice({ to }: { to: string }) {
  const buddies = useRef<(BuddyHandle | null)[]>([])
  const cheer = () => buddies.current.forEach((b, i) => window.setTimeout(() => b?.play('cheer'), i * 120))

  return (
    <Link to={to} onMouseEnter={cheer} onFocus={cheer} className={cn(CARD, 'bg-gradient-to-br from-sun-300 via-sun-400 to-coral-400 text-grape-900')}>
      <span className="relative z-10 flex max-w-[58%] flex-col">
        <span className="font-display text-2xl font-bold leading-tight">I'm a student</span>
        <span className="mt-1 text-sm font-semibold text-grape-900/75">Join your class, play quizzes and collect badges.</span>
        <Go label="Let's play" className="self-start bg-white/75 text-grape-900" />
      </span>
      <span aria-hidden className="absolute -bottom-6 -right-2 flex items-end">
        {PAIR.map((key, i) => (
          <Buddy
            key={key}
            ref={(handle) => {
              buddies.current[i] = handle
            }}
            buddy={key}
            size={i === 0 ? 112 : 124}
            interactive={false}
            bubble="left"
          />
        ))}
      </span>
    </Link>
  )
}

const BARS = [
  { height: [40, 70, 55], tone: 'bg-sun-300' },
  { height: [60, 45, 85], tone: 'bg-mint-400' },
  { height: [30, 80, 65], tone: 'bg-sky-400' },
  { height: [75, 55, 95], tone: 'bg-coral-400' },
] as const

/** A class's results, arriving: bars growing and a score landing. */
function TeacherChoice({ to }: { to: string }) {
  const calm = useCalmMotion()
  return (
    <Link to={to} className={cn(CARD, 'bg-gradient-to-br from-grape-500 via-grape-600 to-grape-800 text-white')}>
      <span className="relative z-10 flex max-w-[58%] flex-col">
        <span className="font-display text-2xl font-bold leading-tight">I'm a teacher</span>
        <span className="mt-1 text-sm font-semibold text-white/80">Run classes, make quizzes from real sources, see who needs help.</span>
        <Go label="Set up my class" className="self-start bg-white/15 text-white ring-1 ring-white/30" />
      </span>

      <span aria-hidden className="absolute bottom-4 right-5 flex h-24 items-end gap-2">
        {BARS.map((bar, i) => (
          <motion.span
            key={i}
            className={cn('w-5 rounded-t-lg', bar.tone)}
            initial={{ height: 8 }}
            animate={calm ? { height: bar.height[2] } : { height: [...bar.height] }}
            transition={calm ? { duration: 0 } : { duration: 3.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: i * 0.25 }}
          />
        ))}
      </span>
      <motion.span
        aria-hidden
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-grape-800 shadow-lg"
        initial={{ opacity: 0, y: -10, scale: 0.8 }}
        animate={calm ? { opacity: 1, y: 0, scale: 1 } : { opacity: [0, 1, 1, 0], y: [-10, 0, 0, -6], scale: [0.8, 1, 1, 0.95] }}
        transition={calm ? { duration: 0 } : { duration: 4, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.12, 0.85, 1], ease: 'easeOut' }}
      >
        <Trophy weight="fill" className="size-3.5 text-sun-400" />
        Aina scored 100%!
      </motion.span>
    </Link>
  )
}
