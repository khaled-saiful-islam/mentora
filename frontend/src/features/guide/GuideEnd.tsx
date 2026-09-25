import { motion } from 'motion/react'
import { useState } from 'react'
import { ArrowRight, Flask, Lightbulb, Translate } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import type { GuideExtras, GuideTerm } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { rise, spring, stagger, useCalmMotion } from '@/motion'

/** Every word to know in the guide, once each, in the order they came. */
export function glossaryOf(sections: { terms: GuideTerm[] }[]): GuideTerm[] {
  const seen = new Set<string>()
  return sections.flatMap((s) => s.terms).filter((t) => {
    const key = t.term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * The last page: the big ideas in a few lines, every word to know as a card
 * that flips, and something to try — then on to the finish.
 */
export function GuideEnd({
  extras,
  glossary,
  translationLabel,
  onFinish,
  finishLabel = 'Finish the guide',
  busy = false,
}: {
  extras: Partial<GuideExtras>
  glossary: GuideTerm[]
  translationLabel: string
  onFinish?: () => void
  finishLabel?: string
  busy?: boolean
}) {
  return (
    <motion.div variants={stagger(0.1)} initial="hidden" animate="shown" className="space-y-6">
      <motion.header variants={rise} className="text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-kind-study-guide">You made it to the end</p>
        <h1 className="mt-2 font-celebrate text-4xl sm:text-5xl">The big ideas</h1>
      </motion.header>

      {extras.summary && extras.summary.length > 0 && (
        <motion.section variants={rise} className="rounded-[2rem] bg-gradient-to-br from-kind-study-guide-vivid to-kind-study-guide p-6 text-white shadow-press sm:p-8">
          <ol className="space-y-3">
            {extras.summary.map((line, i) => (
              <motion.li
                key={line}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring.gentle, delay: 0.25 + i * 0.15 }}
                className="flex items-start gap-3 text-lg font-semibold"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 font-display font-bold">{i + 1}</span>
                <span className="pt-0.5">{line}</span>
              </motion.li>
            ))}
          </ol>
        </motion.section>
      )}

      {glossary.length > 0 && (
        <motion.section variants={rise}>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Translate weight="duotone" className="size-6 text-kind-study-guide" aria-hidden /> Words to know
          </h2>
          <p className="text-sm text-muted-foreground">Tap a card to see what it means.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {glossary.map((term, i) => (
              <WordCard key={term.term} term={term} label={translationLabel} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      {extras.challenge && (
        <motion.section variants={rise} className="relative overflow-hidden rounded-[2rem] border-2 border-dashed border-coral-400/60 bg-coral-100/50 p-6 dark:bg-coral-700/15">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-coral-700 dark:text-coral-100">
            <Flask weight="fill" className="size-5" aria-hidden /> Try this!
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">{extras.challenge.title}</h2>
          <ol className="mt-3 space-y-2">
            {extras.challenge.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coral-400 text-sm font-bold text-white">{i + 1}</span>
                <span className="pt-0.5 text-base md:text-lg">{step}</span>
              </li>
            ))}
          </ol>
        </motion.section>
      )}

      {onFinish && (
        <motion.div variants={rise} className="flex justify-center pt-2">
          <Button size="lg" variant="sun" onClick={onFinish} loading={busy}>
            {finishLabel}
            <ArrowRight weight="bold" className="size-5" />
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

const FACES = [
  'from-sky-400 to-kind-study-guide',
  'from-grape-400 to-grape-600',
  'from-mint-400 to-sky-400',
  'from-coral-400 to-grape-500',
] as const

function WordCard({ term, label, index }: { term: GuideTerm; label: string; index: number }) {
  const [flipped, setFlipped] = useState(false)
  const calm = useCalmMotion()
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={flipped ? `${term.term}: ${term.meaning}` : `${term.term} — tap to see what it means`}
      className="group h-36 [perspective:900px]"
    >
      <motion.span
        className="relative block size-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={calm ? { duration: 0 } : spring.snappy}
      >
        <span className={cn('absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br p-3 text-center font-display text-lg font-bold text-white shadow-press [backface-visibility:hidden]', FACES[index % FACES.length])}>
          {term.term}
          <Lightbulb weight="fill" className="absolute bottom-2.5 right-2.5 size-4 opacity-60" aria-hidden />
        </span>
        <span className="absolute inset-0 flex flex-col justify-center gap-1 rounded-2xl border-2 border-border bg-surface p-3 text-left text-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span>{term.meaning}</span>
          {term.translation && (
            <span className="text-xs text-muted-foreground">
              {label}: <b className="text-foreground">{term.translation}</b>
            </span>
          )}
        </span>
      </motion.span>
    </button>
  )
}
