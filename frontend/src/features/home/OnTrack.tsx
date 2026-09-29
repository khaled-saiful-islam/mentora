/**
 * Keeping each class on its syllabus, on the teacher's home: how far in it
 * is, the next topics not taught yet with a maker for each, the topics the
 * class scored low on, and what is made and waiting to be shared. From the
 * coverage map (`services/coverage_nudges.py`); a class without a syllabus
 * has nothing here yet.
 */
import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, Cards, Exam, MapTrifold, ShareNetwork, TrendDown } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { LearningKindName } from '@/features/learning/api'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'

export interface TopicNudge {
  id: string
  title: string
  area: string
}

export interface ClassNudge {
  class_id: string
  name: string
  subject: string | null
  grade_level: string | null
  taught: number
  topics: number
  next: TopicNudge[]
  low: TopicNudge[]
  ready: number
}

const MAKERS: { kind: LearningKindName; label: string; Icon: typeof Exam }[] = [
  { kind: 'quiz', label: 'Quiz', Icon: Exam },
  { kind: 'flashcard', label: 'Flashcards', Icon: Cards },
  { kind: 'study_guide', label: 'Guide', Icon: BookOpenText },
]

export function OnTrack({ classes }: { classes: ClassNudge[] }) {
  const studio = useLearnStudio()
  const worth = classes.filter((c) => c.next.length || c.low.length || c.ready)
  if (worth.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">Keep your classes on track</h2>
      <p className="mt-1 text-muted-foreground">From each class's syllabus: what to teach next, and what to come back to.</p>
      <motion.ul className="mt-4 grid gap-4 @container" variants={stagger(0.06)} initial="hidden" animate="shown">
        {worth.map((room) => {
          const share = room.topics ? room.taught / room.topics : 0
          return (
            <motion.li key={room.class_id} variants={rise} className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100" aria-hidden>
                  <MapTrifold weight="duotone" className="size-6" />
                </span>
                <div className="min-w-[10rem] flex-1">
                  <p className="break-words font-display text-lg font-semibold leading-tight">{room.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {room.taught} of {room.topics} topics taught
                  </p>
                </div>
                <Link to={`/classes/${room.class_id}/coverage`} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                  The map <ArrowRight weight="bold" className="size-4" aria-hidden />
                </Link>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={room.topics} aria-valuenow={room.taught} aria-label={`${room.taught} of ${room.topics} topics taught`}>
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.round(share * 100)}%` }} transition={{ type: 'spring', stiffness: 70, damping: 18 }} />
              </div>

              {room.next.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-muted-foreground">Next up</p>
                  <ul className="mt-2 space-y-2">
                    {room.next.map((topic) => (
                      <li key={topic.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 p-3">
                        <div className="min-w-[9rem] flex-1">
                          <p className="break-words font-bold">{topic.title}</p>
                          <p className="break-words text-xs text-muted-foreground">{topic.area}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {MAKERS.map(({ kind, label, Icon }) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => studio.create(kind, topic.title)}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-bold hover:-translate-y-0.5 hover:border-hover-border hover:bg-hover"
                              aria-label={`Make a ${label.toLowerCase()} on ${topic.title}`}
                            >
                              <Icon weight="duotone" className="size-4" aria-hidden />
                              {label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(room.low.length > 0 || room.ready > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {room.low.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => studio.create('quiz', topic.title)}
                      className={cn('inline-flex items-center gap-1.5 rounded-full bg-coral-100 px-3 py-1.5 text-sm font-bold text-coral-700 hover:-translate-y-0.5 dark:bg-coral-700/25 dark:text-coral-100')}
                    >
                      <TrendDown weight="bold" className="size-4" aria-hidden />
                      <span className="break-words">Revisit {topic.title}</span>
                    </button>
                  ))}
                  {room.ready > 0 && (
                    <Link to={`/classes/${room.class_id}/coverage`} className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-bold text-sky-700 hover:-translate-y-0.5 dark:bg-sky-700/25 dark:text-sky-100">
                      <ShareNetwork weight="bold" className="size-4" aria-hidden />
                      {room.ready} ready to share
                    </Link>
                  )}
                </div>
              )}
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}
