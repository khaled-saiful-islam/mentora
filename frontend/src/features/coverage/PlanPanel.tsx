/**
 * What to teach next, suggested from where the class is: each step says
 * what to make, for which topic, when, and why — and makes it in one click,
 * opening the right maker already filled in.
 */
import { ArrowRight, Broadcast, Sparkle, X } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { lookOfKind } from '@/features/learning/kinds'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import type { LearningKindName } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { rise, stagger, useCalmMotion } from '@/motion'
import type { PlanStep } from './api'

export function PlanPanel({
  steps,
  busy,
  classId,
  subject,
  onClose,
}: {
  steps: PlanStep[] | null
  busy: boolean
  classId: string
  subject: string | null
  onClose: () => void
}) {
  const calm = useCalmMotion()
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 bg-gradient-to-br from-grape-100 to-sky-100 p-5 dark:from-grape-900/40 dark:to-sky-700/20">
        <motion.span
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-press"
          animate={busy && !calm ? { rotate: [0, 15, -10, 0], scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 1.4, repeat: busy ? Infinity : 0 }}
        >
          <Sparkle weight="fill" className="size-6" aria-hidden />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">What to teach next</h2>
          <p className="text-sm text-muted-foreground">
            {busy ? 'Looking at the whole year — what is done, what is left, and where the class found it hard…' : 'Suggested from your syllabus and how the class did. Make any of them in one click.'}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close the plan" onClick={onClose}>
          <X weight="bold" className="size-5" />
        </Button>
      </div>
      {busy ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-28 rounded-3xl bg-muted" />
          ))}
        </div>
      ) : steps && steps.length > 0 ? (
        <motion.ul className="grid gap-3 p-5 sm:grid-cols-2" variants={stagger(0.06)} initial="hidden" animate="shown">
          {steps.map((step) => (
            <Step key={`${step.topic_id}-${step.kind}-${step.title}`} step={step} classId={classId} subject={subject} />
          ))}
        </motion.ul>
      ) : (
        <p className="p-5 text-sm text-muted-foreground">Nothing to suggest right now — the year looks well covered.</p>
      )}
    </Card>
  )
}

function Step({ step, classId, subject }: { step: PlanStep; classId: string; subject: string | null }) {
  const studio = useLearnStudio()
  const navigate = useNavigate()
  const live = step.kind === 'live'
  const look = live ? null : lookOfKind(step.kind)
  const Icon = look?.Icon ?? Broadcast

  function make() {
    if (live) {
      const query = new URLSearchParams({ class: classId, topic: step.title, ...(subject ? { subject } : {}) })
      navigate(`/live/new?${query}`)
    } else {
      studio.create(step.kind as LearningKindName, step.title)
    }
  }

  return (
    <motion.li variants={rise} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl', look ? look.soft : 'bg-kind-live-vivid/15 text-kind-live')}>
          <Icon weight="duotone" className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold leading-snug">{step.title}</p>
          <p className="text-xs font-bold text-muted-foreground">
            {look?.label ?? 'Live lesson'} · {step.area} — {step.topic}
          </p>
        </div>
        {step.when && <span className="shrink-0 rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-bold text-sun-600 dark:bg-sun-600/25 dark:text-sun-300">{step.when}</span>}
      </div>
      {step.why && <p className="text-sm text-muted-foreground">{step.why}</p>}
      <Button size="sm" variant="outline" className="mt-auto self-start" onClick={make}>
        Make it
        <ArrowRight weight="bold" className="size-4" aria-hidden />
      </Button>
    </motion.li>
  )
}
