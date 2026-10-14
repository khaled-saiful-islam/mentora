/**
 * The mission briefing (§28.3.2): before the story, a dark screen — a radar
 * sweeping, INCOMING MISSION typed out, the game's name, the islands waiting —
 * and one button. That tap is what lets a browser play sound, so the music,
 * the opening's sting and the narrator all begin on it.
 *
 * Under reduced motion the radar holds still and the words are there at once.
 */
import { motion } from 'motion/react'
import { Crosshair, Play } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import type { GameWorld } from '@/features/learning/api'
import { paint } from '../worlds'

const KICKER = 'Incoming mission'
// A typewriter's pace.
const TYPE_MS = 55

export function MissionBriefing({
  title,
  count,
  agent,
  world,
  calm,
  onBegin,
}: {
  title: string
  count: number
  /** The player's first name: "Agent Aina". */
  agent: string
  world: GameWorld
  calm: boolean
  onBegin: () => void
}) {
  const typed = useTyped(`${KICKER}…`, calm)
  const done = typed.length >= KICKER.length + 1
  return (
    <motion.section
      role="dialog"
      aria-label={`Mission briefing: ${title}`}
      initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-lg overflow-hidden rounded-3xl border-4 border-surface p-6 text-center text-white shadow-lg sm:p-8"
      // Night-dark, with only a glow of the world's sky behind the radar, so
      // light text reads on it in every world.
      style={{ background: `radial-gradient(circle at 50% 22%, color-mix(in srgb, ${paint(world, 'sky')} 40%, transparent), transparent 55%), hsl(var(--grape-900))` }}
    >
      <Radar calm={calm} />
      <p className="relative mt-4 min-h-7 font-mono text-sm font-bold uppercase tracking-[0.3em] text-sun-300" aria-hidden>
        {typed}
        {!done && !calm && <span className="animate-pulse">▌</span>}
      </p>
      <p className="sr-only">{KICKER}</p>
      <motion.div initial={calm ? false : { opacity: 0, y: 8 }} animate={done ? { opacity: 1, y: 0 } : undefined} className="relative">
        <h2 className="mt-2 break-words font-celebrate text-4xl leading-tight">{title}</h2>
        <p className="mt-3 break-words font-display text-lg font-semibold opacity-90">For Agent {agent}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-grape-900/50 px-3 py-1 text-sm font-bold">
          <Crosshair weight="bold" className="size-4 shrink-0" aria-hidden />
          {count} {count === 1 ? 'island' : 'islands'} to explore
        </p>
        <div className="mt-6">
          <Button variant="sun" size="lg" onClick={onBegin} autoFocus className="w-full sm:w-auto">
            <Play weight="fill" className="size-5" />
            Start the mission
          </Button>
        </div>
      </motion.div>
    </motion.section>
  )
}

/** A radar sweeping round, with a blip found on it. */
function Radar({ calm }: { calm: boolean }) {
  return (
    <div aria-hidden className="relative mx-auto size-36 overflow-hidden rounded-full border-2 border-white/40 bg-grape-900/40">
      {[0.33, 0.66].map((r) => (
        <span key={r} className="absolute inset-0 m-auto rounded-full border border-white/25" style={{ width: `${r * 100}%`, height: `${r * 100}%` }} />
      ))}
      <span className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: 'conic-gradient(from 0deg, hsl(var(--sun-300) / 0.5), transparent 70deg)' }}
        animate={calm ? { rotate: 0 } : { rotate: 360 }}
        transition={calm ? { duration: 0 } : { duration: 2.6, repeat: Infinity, ease: 'linear' }}
      />
      <motion.span
        className="absolute top-[28%] left-[64%] size-3 rounded-full bg-sun-300 shadow-[0_0_12px_hsl(var(--sun-300))]"
        animate={calm ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
        transition={calm ? { duration: 0 } : { duration: 1.3, repeat: Infinity }}
      />
    </div>
  )
}

/** `text`, a letter at a time — or at once when calm. */
function useTyped(text: string, calm: boolean): string {
  const [shown, setShown] = useState(calm ? text.length : 0)
  useEffect(() => {
    if (shown >= text.length) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), TYPE_MS)
    return () => window.clearTimeout(timer)
  }, [shown, text.length])
  return text.slice(0, shown)
}
