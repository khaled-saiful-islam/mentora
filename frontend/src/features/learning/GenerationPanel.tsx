import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Globe,
  MagnifyingGlass,
  PuzzlePiece,
  Sparkle,
  PencilSimpleLine,
  ShieldCheck,
  X,
  SmileySad,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { celebrate, spring, useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import { isQuiz, type Item, type SetSummary } from './api'
import { lookOfKind } from './kinds'
import { OPTION_LOOKS } from './options'
import { STAGE_ORDER, type Generation, type StageKey } from './useGeneration'

const STAGE_ICONS = { check: ShieldCheck, research: MagnifyingGlass, skills: PuzzlePiece, write: PencilSimpleLine }
const STAGE_WAITING: Record<StageKey, string> = {
  check: 'Checking the topic',
  research: 'Searching trusted sources',
  skills: 'Mapping the skills',
  write: 'Writing and checking every one',
}

type Watched = Pick<SetSummary, 'id' | 'kind' | 'title' | 'topic' | 'grade_label' | 'purpose'>

/**
 * A set being made, shown as it happens — never a spinner. Stages tick in,
 * sources fly in, skills stamp down, and each checked item lands as a card.
 * Closing this does not stop the build.
 */
export function GenerationPanel({
  open,
  set,
  generation,
  onClose,
  onAnother,
}: {
  open: boolean
  set: Watched
  generation: Generation
  onClose: () => void
  onAnother: () => void
}) {
  const look = lookOfKind(set.kind)
  const calm = useCalmMotion()
  const celebrated = useRef<string | null>(null)
  const { outcome } = generation

  useEffect(() => {
    if (open && outcome.kind === 'done' && celebrated.current !== set.id) {
      celebrated.current = set.id
      celebrate({ calm, power: 0.8, origin: { x: 0.8, y: 0.35 } })
    }
  }, [open, outcome.kind, set.id, calm])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div className="absolute inset-0 bg-grape-900/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog"
            aria-label={`Making ${set.topic}`}
            className="relative flex h-dvh w-full max-w-[34rem] flex-col overflow-hidden bg-background shadow-lg"
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: spring.gentle }}
            exit={{ x: '100%', transition: { duration: 0.2 } }}
          >
            <Header look={look} set={set} generation={generation} onClose={onClose} />
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              <Stages generation={generation} />
              <Sources generation={generation} />
              <Skills generation={generation} look={look} />
              <Items items={generation.items} kind={set.kind} />
            </div>
            <Footer set={set} generation={generation} onClose={onClose} onAnother={onAnother} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function progressOf(g: Generation, requested: number): number {
  if (g.outcome.kind === 'done') return 100
  const done = (key: StageKey) => g.stages[key]?.state === 'done'
  if (!g.stages.check) return 3
  if (!done('check')) return 8
  if (!done('research')) return 22
  if (!done('skills')) return 42
  return Math.min(96, 48 + (g.items.length / Math.max(1, requested)) * 48)
}

function Header({ look, set, generation, onClose }: { look: ReturnType<typeof lookOfKind>; set: Watched; generation: Generation; onClose: () => void }) {
  const { outcome } = generation
  const title = outcome.kind === 'done' ? outcome.title : set.topic
  const requested = outcome.kind === 'done' ? outcome.requested : 10
  const progress = progressOf(generation, requested)
  return (
    <header className={cn('relative overflow-hidden px-6 pb-5 pt-6', look.hero)}>
      <span className="blob -right-12 -top-16 size-56 bg-white/40" aria-hidden />
      <div className="relative flex items-start gap-3">
        <motion.span
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/40"
          animate={outcome.kind === 'running' ? { rotate: [0, -6, 6, 0] } : { rotate: 0, scale: [1, 1.15, 1] }}
          transition={outcome.kind === 'running' ? { duration: 2.4, repeat: Infinity } : spring.bouncy}
        >
          <look.Icon weight="duotone" className="size-8" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold opacity-85">
            {outcome.kind === 'running' ? `Making your ${look.label.toLowerCase()}…` : outcome.kind === 'done' ? 'Ready!' : "Couldn't make it"}
          </p>
          <h2 className="truncate font-display text-2xl font-semibold">{title}</h2>
          {set.grade_label && <p className="text-sm opacity-85">{set.grade_label}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close — it keeps going" title="Close — it keeps going" className="grid size-9 place-items-center rounded-full hover:bg-white/20">
          <X weight="bold" className="size-5" />
        </button>
      </div>
      <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="relative h-full overflow-hidden rounded-full bg-white" animate={{ width: `${progress}%` }} transition={spring.lazy}>
          {outcome.kind === 'running' && <span className="skeleton absolute inset-0 opacity-40" />}
        </motion.div>
      </div>
    </header>
  )
}

function Stages({ generation }: { generation: Generation }) {
  return (
    <ol className="space-y-2">
      {STAGE_ORDER.map((key) => {
        const stage = generation.stages[key]
        const Icon = STAGE_ICONS[key]
        const state = stage?.state ?? 'waiting'
        return (
          <motion.li key={key} layout className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5', state === 'running' && 'bg-surface shadow-sm')}>
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', state === 'waiting' ? 'bg-muted text-muted-foreground' : state === 'done' ? 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100' : 'bg-grape-100 text-primary dark:bg-grape-800/40')}>
              <AnimatePresence mode="wait" initial={false}>
                {state === 'done' ? (
                  <motion.span key="done" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy}>
                    <CheckCircle weight="fill" className="size-6" />
                  </motion.span>
                ) : state === 'running' ? (
                  <motion.span key="run" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <CircleNotch weight="bold" className="size-6 animate-spin" />
                  </motion.span>
                ) : (
                  <motion.span key="wait"><Icon weight="duotone" className="size-5" /></motion.span>
                )}
              </AnimatePresence>
            </span>
            <div className="min-w-0">
              <p className={cn('font-bold', state === 'waiting' && 'text-muted-foreground')}>{stage?.label ?? STAGE_WAITING[key]}</p>
              <AnimatePresence>
                {stage?.detail && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="truncate text-sm text-muted-foreground">
                    {stage.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

function Sources({ generation }: { generation: Generation }) {
  if (generation.stages.research?.state !== 'done') return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Globe weight="duotone" className="size-4" />
        Grounded in
      </h3>
      {generation.sources.length === 0 ? (
        <p className="rounded-2xl bg-sun-100 px-4 py-3 text-sm font-semibold text-sun-600 dark:bg-sun-600/25 dark:text-sun-300">No sources found — written from general knowledge. Check it carefully.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {generation.sources.map((source, i) => (
            <motion.a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              title={source.title}
              initial={{ opacity: 0, x: 40, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1, transition: { ...spring.bouncy, delay: i * 0.08 } }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-surface py-1 pl-1 pr-3 text-sm font-bold hover:border-hover-border"
            >
              <span className="grid size-6 place-items-center rounded-full bg-grape-100 text-xs uppercase text-grape-700 dark:bg-grape-800/50 dark:text-grape-100">{source.host[0]}</span>
              {source.host}
            </motion.a>
          ))}
        </div>
      )}
    </section>
  )
}

function Skills({ generation, look }: { generation: Generation; look: ReturnType<typeof lookOfKind> }) {
  if (generation.skills.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <PuzzlePiece weight="duotone" className="size-4" />
        Skills
      </h3>
      <div className="flex flex-wrap gap-2">
        {generation.skills.map((skill, i) => (
          <motion.span
            key={skill.slug}
            initial={{ opacity: 0, scale: 1.8, rotate: i % 2 ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, transition: { ...spring.bouncy, delay: i * 0.1 } }}
            className={cn('rounded-full px-3 py-1 text-sm font-bold', look.soft)}
          >
            {skill.label}
          </motion.span>
        ))}
      </div>
    </section>
  )
}

function Items({ items, kind }: { items: Item[]; kind: string }) {
  if (items.length === 0) return null
  const look = lookOfKind(kind)
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Sparkle weight="duotone" className="size-4" />
        {items.length} checked and ready
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { ...spring.gentle, delay: (i % 5) * 0.12 } }}
            className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm"
            style={{ boxShadow: `0 0 0 1px ${look.colour}22, 0 8px 22px -12px ${look.colour}` }}
          >
            <span className={cn('absolute -left-2 -top-2 grid size-7 place-items-center rounded-full text-xs font-bold shadow', look.hero)}>{i + 1}</span>
            {isQuiz(item) ? (
              <>
                <p className="font-bold">{item.prompt}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {item.options.map((option, o) => (
                    <span key={o} className={cn('flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm', o === item.answer ? OPTION_LOOKS[o].soft + ' font-bold' : 'bg-muted text-muted-foreground')}>
                      {o === item.answer && <CheckCircle weight="fill" className="size-4 shrink-0" />}
                      <span className="truncate">{option}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p className="font-bold">{item.front}</p>
                <p className="text-muted-foreground">{item.back}</p>
              </div>
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

function Footer({ set, generation, onClose, onAnother }: { set: Watched; generation: Generation; onClose: () => void; onAnother: () => void }) {
  const { outcome } = generation
  if (outcome.kind === 'running') {
    return (
      <footer className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
        This takes about a minute. You can close this — we'll tell you when it's ready.
      </footer>
    )
  }
  if (outcome.kind === 'done') {
    return (
      <motion.footer initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.bouncy} className="flex flex-wrap gap-2 border-t border-border bg-surface px-6 py-4">
        {!outcome.grounded && <p className="mb-1 w-full text-sm font-semibold text-warning">Written without web sources — check it before sharing.</p>}
        <Link to={`/library/${set.id}`} onClick={onClose} className="flex-1">
          <Button size="lg" className="w-full">
            {set.purpose === 'practice' ? 'Look it over' : 'Open the editor'}
            <ArrowRight weight="bold" className="size-5" />
          </Button>
        </Link>
        <Button size="lg" variant="outline" onClick={onAnother}>Make another</Button>
      </motion.footer>
    )
  }
  return (
    <footer className="space-y-3 border-t border-border bg-surface px-6 py-4">
      <p className="flex items-start gap-2 font-semibold">
        <SmileySad weight="duotone" className="size-6 shrink-0 text-coral-400" />
        {outcome.message}
      </p>
      <Button onClick={onAnother} variant="outline">Try a different topic</Button>
    </footer>
  )
}
