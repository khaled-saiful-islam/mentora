/**
 * The student's buddy on every page — beside the page, never on it: in the
 * sidebar on a roomy screen, in the header on a phone or a short screen.
 * What it says goes in the layout too — a note above it in the sidebar, a
 * strip under the header on a phone — so its words never cover the page.
 *
 * It knows the student (`brief.ts`) and, on each page, says the useful part
 * (`companion.ts`): what is due, how things have gone, what to practise, a
 * tip for doing better at the kind of work on the page. A line soon after
 * arriving, then now and then, a few a page, and nothing while the tab is
 * hidden. Tapped, it does its trick and says the next useful thing.
 *
 * Home and *My buddy* have a buddy of their own, so it stays out of those.
 * In a live lesson it makes no sound — Astra is talking — and says one tip.
 */
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { Buddy, type BuddyHandle } from './Buddy'
import { useBuddyBrief } from './brief'
import { linesFor, placeOf, type Place } from './companion'
import { profileOf } from './profiles'

export const FIRST_AFTER_MS = 2500
export const EVERY_MS = 45_000
export const SHOWN_MS = 9000
const MOST: Partial<Record<Place, number>> = { room: 1 }
const MOST_A_PAGE = 3

export interface Companion {
  buddy: React.RefObject<BuddyHandle>
  buddyKey: string | null | undefined
  line: string | null
  hushed: boolean
  tap: () => void
  dismiss: () => void
}

/** The companion for this page, or null where it does not go. */
export function useCompanion(): Companion | null {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const place = placeOf(pathname)
  const student = user?.role === 'student'
  const brief = useBuddyBrief(student)
  const buddy = useRef<BuddyHandle>(null)
  const turn = useRef(0)
  const [line, setLine] = useState<string | null>(null)
  const hide = useRef(0)
  // One roll of the dice a page, so its lines hold still while it is open.
  const seed = useMemo(() => Math.random(), [pathname])
  const lines = useMemo(() => (brief ? linesFor(place, brief, new Date(), seed) : []), [brief, place, seed])
  const lead = lines[0] ?? ''

  const speak = useCallback((text: string, mood: 'wave' | 'nod') => {
    window.clearTimeout(hide.current)
    setLine(text)
    buddy.current?.play(mood)
    buddy.current?.say(text, SHOWN_MS)
    hide.current = window.setTimeout(() => setLine(null), SHOWN_MS)
  }, [])

  // A few lines a page: soon after arriving, then now and then.
  useEffect(() => {
    turn.current = 0
    setLine(null)
    if (!lead) return
    const said = lines
    const most = Math.min(MOST[place] ?? MOST_A_PAGE, said.length)
    let timer = 0
    const next = (wait: number) => {
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          speak(said[turn.current % said.length], turn.current === 0 ? 'wave' : 'nod')
          turn.current += 1
        }
        if (turn.current < most) next(EVERY_MS)
      }, wait)
    }
    next(FIRST_AFTER_MS)
    return () => window.clearTimeout(timer)
    // Once per page: a refreshed brief must not start the page over.
  }, [pathname, Boolean(lead)])

  useEffect(() => () => window.clearTimeout(hide.current), [])

  if (!student || place === 'home' || place === 'buddy') return null
  return {
    buddy,
    buddyKey: user?.buddy,
    line,
    hushed: place === 'room',
    tap: () => {
      buddy.current?.trick(false)
      const text = lines[turn.current % Math.max(lines.length, 1)]
      if (text) {
        turn.current += 1
        window.setTimeout(() => speak(text, 'nod'), 450)
      }
    },
    dismiss: () => {
      window.clearTimeout(hide.current)
      setLine(null)
    },
  }
}

/** The buddy itself: in the sidebar, or small in the header. */
export function CompanionBuddy({ companion, slot }: { companion: Companion; slot: 'side' | 'bar' }) {
  const profile = profileOf(companion.buddyKey)
  return (
    <div className={cn('flex items-center', slot === 'side' ? 'flex-col gap-1 py-1' : 'shrink-0')}>
      <button
        type="button"
        onClick={companion.tap}
        className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
        aria-label={`${profile.name}, your buddy. Tap for a tip!`}
      >
        <Buddy ref={companion.buddy} buddy={companion.buddyKey} size={slot === 'side' ? 96 : 52} interactive={false} speaks={false} hushed={companion.hushed} />
      </button>
      {slot === 'side' && <p className="text-center text-xs font-bold text-muted-foreground">{profile.name} · tap me for a tip</p>}
    </div>
  )
}

/** What the buddy is saying, in the layout: a note in the sidebar, or a
 *  strip under the header. It pushes the page down rather than cover it. */
export function CompanionNote({ companion, slot }: { companion: Companion; slot: 'side' | 'bar' }) {
  const profile = profileOf(companion.buddyKey)
  return (
    <div aria-live="polite" className={slot === 'bar' ? 'border-b border-border/60 bg-background/95' : undefined}>
      <AnimatePresence initial={false}>
        {companion.line && (
          <motion.div
            key={companion.line}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.gentle}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'flex items-start gap-2',
                slot === 'side' ? 'mb-1 rounded-2xl border-2 border-border bg-surface p-3 shadow-sm' : 'px-4 py-2.5 md:px-8',
              )}
            >
              <p className="min-w-0 flex-1 break-words text-sm font-semibold">
                <span className="font-bold text-primary">{profile.name}: </span>
                {companion.line}
              </p>
              <button
                type="button"
                onClick={companion.dismiss}
                aria-label="Thanks, got it"
                className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
              >
                <X weight="bold" className="size-3.5" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
