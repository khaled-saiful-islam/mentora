import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, Clock, ListNumbers, Question, type Icon } from '@phosphor-icons/react'
import { Button, Chip } from '@/components/ui'
import type { GuideExtras, GuidePicture, ReadingLevel } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { rise, spring, stagger, useCalmMotion } from '@/motion'
import { ConceptMapView } from './ConceptMapView'
import { LevelSwitch, LEVEL_LOOKS } from './LevelSwitch'
import { minutesToRead, wordCount } from './text'

export interface CoverSection {
  heading: string
  terms: { term: string }[]
  image: GuidePicture | null
  explain: Record<ReadingLevel, string>
}

/** Each polaroid's tilt, so the pile looks dropped rather than arranged. */
const TILTS = ['rotate-6', '-rotate-3', '-rotate-6', 'rotate-3'] as const

/**
 * The first page: a question worth reading on for, pictures from inside,
 * a map of how it fits together, and how the reader would like it written.
 */
export function GuideCover({
  title,
  extras,
  sections,
  level,
  onLevel,
  onStart,
  onJump,
  resumeAt,
  meta,
}: {
  title: string
  extras: Partial<GuideExtras>
  sections: CoverSection[]
  level: ReadingLevel
  onLevel: (level: ReadingLevel) => void
  onStart: () => void
  onJump?: (section: number) => void
  /** Part to carry on from, when some are already done. */
  resumeAt?: number
  meta?: string[]
}) {
  const calm = useCalmMotion()
  const pictures = sections.map((s) => s.image).filter((p): p is GuidePicture => Boolean(p)).slice(0, TILTS.length)
  const minutes = minutesToRead(sections.reduce((n, s) => n + wordCount(s.explain[level] || s.explain.core), 0))
  const started = resumeAt !== undefined && resumeAt > 0

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="shown">
      <motion.section variants={rise} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kind-study-guide-vivid via-kind-study-guide to-grape-700 p-6 text-white shadow-press sm:p-10">
        <span className="blob -left-12 -top-16 size-64 bg-sky-400 opacity-50" aria-hidden />
        <span className="blob -bottom-24 right-1/3 size-72 bg-grape-400 opacity-40 [animation-delay:-8s]" aria-hidden />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-white/85">
            <BookOpenText weight="fill" className="size-5" aria-hidden /> Study guide · {title}
          </p>
          <h1 className="mt-3 font-celebrate text-3xl leading-[1.1] sm:text-4xl lg:text-5xl">
            {extras.big_question || title}
          </h1>
          {extras.intro && <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/90">{extras.intro}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <HeroChip Icon={ListNumbers}>{sections.length} parts</HeroChip>
            <HeroChip Icon={Clock}>About {minutes} min</HeroChip>
            {meta?.map((m) => (
              <HeroChip key={m}>{m}</HeroChip>
            ))}
          </div>
        </div>
        {pictures.length > 0 && <Polaroids pictures={pictures} calm={calm} />}
        </div>
      </motion.section>

      <motion.section variants={rise} className="mt-6 rounded-[2rem] border border-border bg-surface p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Question weight="duotone" className="size-6 text-kind-study-guide" aria-hidden /> How it all fits together
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Tap a part to jump straight to it.</p>
        <ConceptMapView title={title} sections={sections} onJump={onJump} className="mt-4" />
      </motion.section>

      <motion.section variants={rise} className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[2rem] border border-border bg-surface p-5 sm:p-7">
          <h2 className="font-display text-xl font-bold">What you'll learn</h2>
          <ol className="mt-3 space-y-2">
            {sections.map((section, i) => (
              <li key={section.heading} className="flex items-center gap-3">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-full font-display font-bold', started && i < (resumeAt ?? 0) ? 'bg-correct text-white' : 'bg-kind-study-guide-vivid/15 text-kind-study-guide')}>
                  {i + 1}
                </span>
                <span className="font-semibold">{section.heading}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col justify-between gap-5 rounded-[2rem] border border-border bg-surface p-5 sm:p-7 lg:w-96">
          <div>
            <h2 className="font-display text-xl font-bold">How would you like to read?</h2>
            <p className="mt-1 text-sm text-muted-foreground">{LEVEL_LOOKS[level].hint}. You can change it on any page.</p>
            <LevelSwitch value={level} onChange={onLevel} block className="mt-4" />
          </div>
          <Button size="lg" variant="sun" onClick={onStart} className="w-full">
            {started ? `Carry on from part ${(resumeAt ?? 0) + 1}` : 'Start reading'}
            <ArrowRight weight="bold" className="size-5" />
          </Button>
        </div>
      </motion.section>
    </motion.div>
  )
}

/** The guide's pictures, pinned beside the words — a peek at what's inside. */
function Polaroids({ pictures, calm }: { pictures: GuidePicture[]; calm: boolean }) {
  return (
    <div aria-hidden className="hidden grid-cols-2 gap-3 md:grid md:w-52 lg:w-60">
      {pictures.map((picture, i) => (
        <motion.div
          key={picture.image}
          className={cn('rounded-xl bg-white p-1.5 pb-4 shadow-xl', TILTS[i])}
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          animate={calm ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: [0, -5, 0], scale: 1 }}
          transition={calm ? { duration: 0 } : { opacity: { delay: 0.3 + i * 0.12 }, scale: { ...spring.bouncy, delay: 0.3 + i * 0.12 }, y: { duration: 5 + i, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <img src={picture.thumbnail || picture.image} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-lg object-cover" />
        </motion.div>
      ))}
    </div>
  )
}

function HeroChip({ Icon, children }: { Icon?: Icon; children: React.ReactNode }) {
  return (
    <Chip className="bg-white/15 text-sm text-white ring-1 ring-white/25">
      {Icon && <Icon weight="bold" className="size-4" />}
      {children}
    </Chip>
  )
}
