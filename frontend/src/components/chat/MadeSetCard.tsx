/**
 * A quiz, deck or study guide the chat started making (`make_learning_set`),
 * in its kind's own colours.
 *
 * It follows the build: a shimmer while it is being made, then *Ready* with
 * Preview, Share and Open. Open goes to the creation itself — the live panel
 * in the Library while it is being made, the editor once it is ready. It asks
 * the set itself how it is doing, so it is right after a reload too, and it
 * stops asking once the build has ended.
 */
import { motion } from 'motion/react'
import { ArrowRight, Eye, ShareNetwork, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { learningApi, type SetDetail } from '@/features/learning/api'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { useOptionalLearnStudio } from '@/features/learning/LearnStudio'
import { ShareDialog } from '@/features/learning/ShareDialog'
import { useAuth } from '@/lib/auth'
import type { Source } from '@/lib/chat-types'
import { can } from '@/lib/user'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'

/** How often to ask while it is being made. */
export const CHECK_EVERY_MS = 4000

/** The set's id from its card's address, `/library/{id}`. */
export function setIdOf(url: string): string | null {
  const match = /^\/library\/([0-9a-f-]{8,})/i.exec(url)
  return match ? match[1] : null
}

export function MadeSetCard({ source }: { source: Source }) {
  const id = setIdOf(source.url)
  const [set, setSet] = useState<SetDetail | null>(null)
  const [gone, setGone] = useState(false)
  const [sharing, setSharing] = useState(false)
  const studio = useOptionalLearnStudio()
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!id) return
    let stopped = false
    let timer = 0
    const check = async () => {
      try {
        const found = await learningApi.get(id)
        if (stopped) return
        setSet(found)
        if (found.status === 'generating') timer = window.setTimeout(() => void check(), CHECK_EVERY_MS)
      } catch {
        // Deleted since, or never this person's: the card says so and stops.
        if (!stopped) setGone(true)
      }
    }
    void check()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [id])

  if (!id) return null
  const kind = set?.kind ?? kindFrom(source.snippet)
  const look = lookOfKind(kind)
  const status = gone ? 'gone' : (set?.status ?? 'generating')
  const making = status === 'generating'
  const ready = status === 'ready'
  const playable = kind !== 'study_guide'

  function open() {
    // While it is being made, the creation is the live panel in the Library.
    if (making && studio && set) {
      navigate('/library')
      studio.watch(set)
      return
    }
    navigate(`/library/${id}`)
  }

  return (
    <motion.div
      className={cn('my-3 overflow-hidden rounded-2xl border-2 bg-surface shadow-sm', look.ring)}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
    >
      <div className={cn('relative flex items-center gap-3 overflow-hidden px-4 py-3', look.hero)}>
        <look.Icon weight="duotone" aria-hidden className="absolute -right-3 -bottom-5 size-20 rotate-[-10deg] opacity-25" />
        <motion.span
          className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20"
          animate={making ? { rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] } : { rotate: 0, scale: 1 }}
          transition={making ? { duration: 1.8, repeat: Infinity } : spring.bouncy}
          aria-hidden
        >
          <look.Icon weight="fill" className="size-6" />
        </motion.span>
        <div className="relative min-w-0 flex-1">
          <p className="break-words text-sm font-bold opacity-90">{source.snippet}</p>
          <p className="break-words font-display text-lg leading-tight font-semibold">{set?.title || source.title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <p role="status" className={cn('inline-flex min-w-[10rem] flex-1 items-center gap-1.5 text-sm font-bold', ready ? look.text : making ? look.text : 'text-wrong')}>
          {making && <Sparkle weight="fill" className="size-4 shrink-0 animate-pulse" aria-hidden />}
          {!making && !ready && <WarningCircle weight="fill" className="size-4 shrink-0" aria-hidden />}
          <span className="break-words">
            {making && 'Making it — about a minute'}
            {ready && `Ready — ${nounOf(kind, set?.item_count ?? 0)}`}
            {(status === 'failed' || status === 'refused') && 'It could not be made. Open it to try again.'}
            {status === 'gone' && 'No longer in your Library.'}
          </span>
        </p>
        {status !== 'gone' && (
          <div className="flex flex-wrap items-center gap-2">
            {ready && (
              <Link to={playable ? `/library/${id}/try` : `/library/${id}/preview`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-bold hover:bg-hover">
                <Eye weight="bold" className="size-4" aria-hidden />
                Preview
              </Link>
            )}
            {ready && set && can(user, 'share_learning_sets') && (
              <button type="button" onClick={() => setSharing(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-bold hover:bg-hover">
                <ShareNetwork weight="bold" className="size-4" aria-hidden />
                Share
              </button>
            )}
            <button type="button" onClick={open} className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold shadow-press', look.hero)}>
              {making ? 'Watch it being made' : 'Open'}
              <ArrowRight weight="bold" className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
      {making && (
        <div className="h-1.5 overflow-hidden bg-muted" aria-hidden>
          <motion.div className="h-full w-1/3 rounded-full" style={{ backgroundColor: look.colour }} animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      )}
      {sharing && set && <ShareDialog open set={set} onClose={() => setSharing(false)} />}
    </motion.div>
  )
}

/** The kind from the card's line ("Quiz · Year 4 · Maths"), before the set answers. */
function kindFrom(snippet: string): string {
  const first = snippet.split('·')[0]?.trim().toLowerCase() ?? ''
  if (first.startsWith('flash')) return 'flashcard'
  if (first.startsWith('study')) return 'study_guide'
  return 'quiz'
}
