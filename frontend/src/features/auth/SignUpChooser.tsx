import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Backpack, ChalkboardTeacher } from '@phosphor-icons/react'
import { rise, spring, stagger } from '@/motion'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'

const CHOICES = [
  {
    to: '/signup/student',
    title: "I'm a student",
    blurb: 'Join your class, play quizzes and flashcards, and earn badges.',
    Icon: Backpack,
    tile: 'from-sun-300 to-sun-400 text-grape-900',
    ring: 'hover:border-sun-400',
  },
  {
    to: '/signup/teacher',
    title: "I'm a teacher",
    blurb: 'Run classes, make quizzes from real sources, and see who needs help.',
    Icon: ChalkboardTeacher,
    tile: 'from-grape-400 to-grape-700 text-white',
    ring: 'hover:border-grape-400',
  },
] as const

export default function SignUpChooser() {
  // An invite link lands here with its token; keep it on the student path.
  const [params] = useSearchParams()
  const invite = params.get('invite')

  return (
    <AuthLayout
      heroTitle="Let's get you started!"
      heroSubtitle="Pick who you are and we'll set things up just right."
    >
      <h1 className="font-display text-4xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-muted-foreground">Who's joining Mentora today?</p>

      <motion.ul className="mt-8 space-y-4" variants={stagger(0.08, 0.1)} initial="hidden" animate="shown">
        {CHOICES.map(({ to, title, blurb, Icon, tile, ring }) => (
          <motion.li key={to} variants={rise}>
            <Link
              to={invite && to.endsWith('student') ? `${to}?invite=${encodeURIComponent(invite)}` : to}
              className={cn(
                'group flex items-center gap-4 rounded-[1.5rem] border-2 border-border bg-surface p-4 shadow-sm',
                'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg',
                ring,
              )}
            >
              <motion.span
                className={cn('grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-press', tile)}
                whileHover={{ rotate: [0, -8, 8, -4, 0], transition: { duration: 0.5 } }}
              >
                <Icon weight="duotone" className="size-9" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{blurb}</span>
              </span>
              <motion.span
                className="text-muted-foreground group-hover:text-primary"
                initial={false}
                whileHover={{ x: 4 }}
                transition={spring.snappy}
              >
                <ArrowRight weight="bold" className="size-6 transition-transform group-hover:translate-x-1" />
              </motion.span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
