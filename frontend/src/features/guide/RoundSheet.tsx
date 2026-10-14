/**
 * A guide's game, full screen (§28.3.8): a part's one-minute rounds, one
 * after another, or the guide's Boss Battle at the end. The same rounds a
 * game plays (`features/game/rounds`), with the buddy saying why a move was
 * wrong and "Show me" once the child is stuck. Nothing here is marked: it is
 * practice, and the part's check is what counts.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Eye, GameController, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { trapTab } from '@/components/ui/Dialog'
import { BuddyAvatar } from '@/features/buddies'
import { useCoversScreen } from '@/features/celebrate/Scene'
import { PLAY_LABELS, Round, type AnyRound, type Band, type BossContent, type Move } from '@/features/game/rounds'
import { useAuth } from '@/lib/auth'
import { useSound } from '@/lib/sound'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { PartRound } from './journey'

/** A round the sheet can play: a part's, or the boss. */
export type SheetRound = PartRound | { play: 'boss'; content: BossContent }

// Wrong moves on a round before "Show me" is offered, as in a game (§25).
const STUCK_AFTER = 2
const NEXT_AFTER_MS = 900

export function RoundSheet({ title, rounds, band, onClose, onDone }: { title: string; rounds: SheetRound[]; band: Band; onClose: () => void; onDone: () => void }) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const sound = useSound()
  const calm = useCalmMotion()
  const [at, setAt] = useState(0)
  const [finished, setFinished] = useState(false)
  const [slips, setSlips] = useState(0)
  const [showMe, setShowMe] = useState(0)
  const [line, setLine] = useState<string | null>(null)
  const round = rounds[at]
  useCoversScreen()

  useEffect(() => {
    const returnTo = document.activeElement
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') trapTab(event, panel.current)
    }
    window.addEventListener('keydown', onKey)
    const scrolled = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrolled
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
    }
  }, [onClose])

  const onMove = useCallback((move: Move) => {
    if (!move.right) setSlips((n) => n + 1)
  }, [])

  const roundDone = useCallback(() => {
    sound('finish')
    if (at + 1 < rounds.length) {
      setLine('Great! One more.')
      window.setTimeout(() => {
        setAt((n) => n + 1)
        setSlips(0)
        setLine(null)
      }, NEXT_AFTER_MS)
      return
    }
    setFinished(true)
    setLine(null)
    celebrate({ calm, power: 0.8 })
    onDone()
  }, [at, rounds.length, sound, calm, onDone])

  if (!round) return null
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kind-games-vivid text-white" aria-hidden>
            <GameController weight="fill" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {PLAY_LABELS[round.play]}
              {rounds.length > 1 && ` · ${at + 1} of ${rounds.length}`}
            </p>
            <h2 id={titleId} className="break-words font-display text-lg leading-tight font-semibold">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Back to the guide" className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
            <X weight="bold" className="size-5" />
          </button>
        </header>
        <main className="min-h-0 flex-1 bg-gradient-to-b from-sky-100/60 to-background dark:from-sky-700/10">
          {finished ? (
            <Finished onClose={onClose} />
          ) : (
            <Round key={`${at}-${round.play}`} {...(round as AnyRound)} band={band} calm={calm} say={setLine} sound={sound} showMe={showMe} onMove={onMove} onDone={roundDone} />
          )}
        </main>
        <footer className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <BuddyAvatar buddy={user?.buddy} mood={finished ? 'cheer' : line ? 'think' : 'idle'} size={44} />
          <AnimatePresence mode="wait">
            <motion.p key={line ?? 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.snappy} className="min-w-0 flex-1 break-words font-semibold" aria-live="polite">
              {line ?? (finished ? 'You did it!' : 'You can do it. Take your time.')}
            </motion.p>
          </AnimatePresence>
          {!finished && slips >= STUCK_AFTER && (
            <Button variant="sun" size="sm" onClick={() => setShowMe((n) => n + 1)}>
              <Eye weight="bold" className="size-4" />
              Show me
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Finished({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="grid h-full place-items-center p-6 text-center">
      <div>
        <p className="font-celebrate text-5xl">All done!</p>
        <p className="mt-2 text-lg text-muted-foreground">Back to the guide for the next part.</p>
        <Button size="lg" className="mt-6" onClick={onClose}>
          Back to the guide
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </motion.div>
  )
}
