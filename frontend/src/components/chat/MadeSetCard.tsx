/**
 * A quiz, deck or study guide the chat started making (`make_learning_set`).
 *
 * It follows the build: a shimmer while it is being made, then *Ready* with
 * Open and Preview. It asks the set itself how it is doing, so it is right
 * after a reload too, and it stops asking once the build has ended.
 */
import { motion } from 'motion/react'
import { ArrowRight, Eye, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { learningApi, type SetStatus } from '@/features/learning/api'
import { lookOfKind } from '@/features/learning/kinds'
import type { Source } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'

/** How often to ask while it is being made. */
export const CHECK_EVERY_MS = 4000

interface Known {
  kind: string
  title: string
  status: SetStatus | 'gone'
  items: number
}

/** The set's id from its card's address, `/library/{id}`. */
export function setIdOf(url: string): string | null {
  const match = /^\/library\/([0-9a-f-]{8,})/i.exec(url)
  return match ? match[1] : null
}

export function MadeSetCard({ source }: { source: Source }) {
  const id = setIdOf(source.url)
  const [known, setKnown] = useState<Known | null>(null)

  useEffect(() => {
    if (!id) return
    let stopped = false
    let timer = 0
    const check = async () => {
      try {
        const set = await learningApi.get(id)
        if (stopped) return
        setKnown({ kind: set.kind, title: set.title, status: set.status, items: set.item_count })
        if (set.status === 'generating') timer = window.setTimeout(() => void check(), CHECK_EVERY_MS)
      } catch {
        // Deleted since, or never this person's: the card says so and stops.
        if (!stopped) setKnown((now) => ({ kind: now?.kind ?? '', title: now?.title ?? source.title, status: 'gone', items: 0 }))
      }
    }
    void check()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [id, source.title])

  if (!id) return null
  const look = lookOfKind(known?.kind || kindFrom(source.snippet))
  const status = known?.status ?? 'generating'
  const making = status === 'generating'
  const ready = status === 'ready'
  const playable = (known?.kind || kindFrom(source.snippet)) !== 'study_guide'
  return (
    <motion.div
      className="my-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <motion.span
          className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', look.hero)}
          animate={making ? { rotate: [0, -6, 6, 0], scale: [1, 1.05, 1] } : { rotate: 0, scale: 1 }}
          transition={making ? { duration: 1.8, repeat: Infinity } : spring.bouncy}
          aria-hidden
        >
          <look.Icon weight="fill" className="size-6" />
        </motion.span>
        <div className="min-w-[10rem] flex-1">
          <p className="break-words font-display text-lg leading-tight font-semibold">{known?.title || source.title}</p>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">{source.snippet}</p>
          <p role="status" className={cn('mt-1 inline-flex items-center gap-1.5 text-sm font-bold', ready ? 'text-correct' : status === 'generating' ? 'text-primary' : 'text-wrong')}>
            {making && <Sparkle weight="fill" className="size-4 shrink-0 animate-pulse" aria-hidden />}
            {!making && !ready && <WarningCircle weight="fill" className="size-4 shrink-0" aria-hidden />}
            {making && 'Making it — about a minute'}
            {ready && `Ready — ${known?.items ?? 0} ${playable ? (look.label === 'Quiz' ? 'questions' : 'cards') : 'parts'}`}
            {(status === 'failed' || status === 'refused') && 'It could not be made. Open it to try again.'}
            {status === 'gone' && 'No longer in your Library.'}
          </p>
        </div>
        {status !== 'gone' && (
          <div className="flex flex-wrap items-center gap-2">
            {ready && (
              <Link to={playable ? `/library/${id}/try` : `/library/${id}/preview`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-bold hover:bg-hover">
                <Eye weight="bold" className="size-4" aria-hidden />
                Preview
              </Link>
            )}
            <Link to={`/library/${id}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-press">
              Open
              <ArrowRight weight="bold" className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
      {making && (
        <div className="h-1.5 overflow-hidden bg-muted" aria-hidden>
          <motion.div className="h-full w-1/3 rounded-full bg-primary/70" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      )}
    </motion.div>
  )
}

/** The kind from the card's line ("Quiz · Year 4 · Maths"), before the set answers. */
function kindFrom(snippet: string): string {
  const first = snippet.split('·')[0]?.trim().toLowerCase() ?? ''
  if (first.startsWith('quiz')) return 'quiz'
  if (first.startsWith('flash')) return 'flashcard'
  if (first.startsWith('study')) return 'study_guide'
  return 'quiz'
}
