import { motion, type TargetAndTransition } from 'motion/react'
import { Brain, CheckCircle, MapPin, Pause, Sparkle, SpeakerHigh } from '@phosphor-icons/react'
import { Chip } from '@/components/ui'
import type { GuidePicture, GuideTerm, ReadingLevel } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { rise, spring, stagger } from '@/motion'
import { LevelSwitch } from './LevelSwitch'
import { PictureFrame } from './PictureFrame'
import { TermText } from './TermText'
import type { ReadAloud } from './useReadAloud'

/** What a section shows, from the student's side or the teacher's. */
export interface Readable {
  id: string
  heading: string
  explain: Record<ReadingLevel, string>
  points: string[]
  terms: GuideTerm[]
  hook: string
  fact: string
  example: string
  image: GuidePicture | null
}

/**
 * One part of a guide, the reading half: the picture, the teaching at the
 * level the reader chose, then what makes it stick. The check comes after,
 * from whoever is showing it.
 */
export function SectionBody({
  section,
  number,
  total,
  skill,
  level,
  onLevel,
  voice,
  translationLabel,
  onFact,
  still = false,
}: {
  section: Readable
  number: number
  total: number
  skill?: string
  level: ReadingLevel
  onLevel: (level: ReadingLevel) => void
  voice: ReadAloud
  translationLabel: string
  /** The "did you know?" came into view — a buddy may want to react. */
  onFact?: () => void
  /** Everything shown at once, nothing waiting to scroll into view — for a
   *  preview or a printed page, where unseen parts would come out blank. */
  still?: boolean
}) {
  const text = section.explain[level] || section.explain.core
  const key = `${section.id}:${level}`
  const reading = voice.reading === key

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="sun" className="text-sm">
          Part {number} of {total}
        </Chip>
        {skill && <Chip className="min-w-0 max-w-[75%] break-words text-sm">{skill}</Chip>}
      </div>
      <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">{section.heading}</h1>

      <PictureFrame picture={section.image} alt={section.heading} className="mt-5" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <LevelSwitch value={level} onChange={onLevel} />
        {voice.supported && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => (reading ? voice.stop() : voice.read(key, text))}
            aria-pressed={reading}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors',
              reading
                ? 'border-kind-study-guide-vivid bg-kind-study-guide-vivid text-white'
                : 'border-border bg-surface text-foreground hover:border-hover-border hover:bg-hover',
            )}
          >
            {reading ? <Pause weight="fill" className="size-4" /> : <SpeakerHigh weight="fill" className="size-4" />}
            {reading ? 'Stop reading' : 'Read it to me'}
            {reading && <Equaliser />}
          </motion.button>
        )}
      </div>

      <motion.div key={level} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
        <TermText
          text={text}
          terms={section.terms}
          reading={reading ? voice.at : null}
          translationLabel={translationLabel}
          className="mt-5 text-lg leading-relaxed md:text-xl md:leading-relaxed"
        />
      </motion.div>

      {section.points.length > 0 && <Remember points={section.points} still={still} />}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {section.hook && <MemoryHook hook={section.hook} still={still} />}
        {section.example && <RealLife example={section.example} still={still} />}
      </div>

      {section.fact && <FunFact fact={section.fact} onSeen={onFact} still={still} />}
    </article>
  )
}

/** Animate on scrolling into view — or straight away, when still. */
function reveal(still: boolean, target: string | TargetAndTransition, amount = 0.5) {
  return still ? { animate: target } : { whileInView: target, viewport: { once: true, amount } }
}

function Remember({ points, still }: { points: string[]; still: boolean }) {
  return (
    <section className="mt-7 rounded-[1.75rem] border-2 border-mint-400/40 bg-mint-100/60 p-5 dark:bg-mint-700/15">
      <h2 className="font-display text-lg font-bold text-mint-700 dark:text-mint-100">Remember</h2>
      <motion.ul className="mt-3 space-y-2.5" variants={stagger(0.12)} initial="hidden" {...reveal(still, 'shown', 0.6)}>
        {points.map((point) => (
          <motion.li key={point} variants={rise} className="flex items-start gap-2.5 text-base md:text-lg">
            <CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-mint-400" aria-hidden />
            <span>{point}</span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}

/** A sticky note, a little crooked, with a strip of tape. */
function MemoryHook({ hook, still }: { hook: string; still: boolean }) {
  return (
    <motion.aside
      initial={{ opacity: 0, rotate: -6, y: 16 }}
      {...reveal(still, { opacity: 1, rotate: -1.5, y: 0 })}
      whileHover={{ rotate: 0, scale: 1.02 }}
      transition={spring.bouncy}
      className="relative rounded-2xl bg-sun-100 p-5 pt-6 text-grape-900 shadow-md dark:bg-sun-600/25 dark:text-sun-100"
    >
      <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-2 rounded-sm bg-white/70 shadow-sm dark:bg-white/20" />
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-sun-600 dark:text-sun-300">
        <Brain weight="fill" className="size-4" aria-hidden /> Remember it like this
      </p>
      <p className="mt-2 font-display text-lg font-bold leading-snug">{hook}</p>
    </motion.aside>
  )
}

function RealLife({ example, still }: { example: string; still: boolean }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      {...reveal(still, { opacity: 1, y: 0 })}
      transition={{ ...spring.gentle, delay: 0.1 }}
      className="rounded-2xl border-2 border-sky-400/40 bg-sky-100/60 p-5 dark:bg-sky-700/15"
    >
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-sky-700 dark:text-sky-100">
        <MapPin weight="fill" className="size-4" aria-hidden /> In real life
      </p>
      <p className="mt-2 text-base leading-snug md:text-lg">{example}</p>
    </motion.aside>
  )
}

function FunFact({ fact, onSeen, still }: { fact: string; onSeen?: () => void; still: boolean }) {
  return (
    <motion.aside
      initial={{ opacity: 0, scale: 0.94 }}
      {...reveal(still, { opacity: 1, scale: 1 }, 0.7)}
      onViewportEnter={onSeen}
      transition={spring.bouncy}
      className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-grape-500 to-grape-700 p-5 text-white shadow-press"
    >
      <span className="blob -right-8 -top-10 size-40 bg-coral-400" aria-hidden />
      <p className="relative flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-white/80">
        <Sparkle weight="fill" className="size-4 text-sun-300" aria-hidden /> Did you know?
      </p>
      <p className="relative mt-2 font-display text-xl font-bold leading-snug">{fact}</p>
    </motion.aside>
  )
}

/** Three bars bouncing while the voice speaks. */
function Equaliser() {
  return (
    <span className="flex h-3.5 items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-white"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}
