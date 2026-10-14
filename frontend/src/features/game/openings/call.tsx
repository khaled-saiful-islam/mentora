/**
 * The video-call opening (§26.8): the story's character rings the player.
 * They answer, and the story comes in as a chat — each line after a moment
 * of "typing…" — then the goal and the way in. When calm, the call is
 * answered to the whole chat at once.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Phone, VideoCamera } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { told } from '../cards'
import { paint } from '../worlds'
import { Face, Footer, Goal, Scene, islandsToExplore, speakerOf, useShown, type OpeningProps } from './parts'
import { useMissionSound } from '../mission/context'
import { playSting } from '../mission/score'
import { Said } from '../mission/narration'

// Each line arrives after the one before, with "typing…" between.
const LINE_MS = 1100

export function CallOpening(props: OpeningProps) {
  const [answered, setAnswered] = useState(false)
  const caller = props.cast.character || props.title
  return (
    <Scene calm={props.calm}>
      <div className="px-5 pb-5 pt-6 text-white sm:px-6" style={{ background: `linear-gradient(170deg, ${paint(props.world, 'sky')}, ${paint(props.world, 'haze')} 70%)` }}>
        <AnimatePresence mode="wait" initial={false}>
          {answered ? <Chat key="chat" {...props} caller={caller} /> : <Ringing key="ring" caller={caller} calm={props.calm} title={props.title} onAnswer={() => setAnswered(true)} cast={props.cast} />}
        </AnimatePresence>
      </div>
    </Scene>
  )
}

// The phone rings again this often until it is answered.
const RING_EVERY_MS = 4200

function Ringing({ caller, title, calm, cast, onAnswer }: { caller: string; title: string; calm: boolean; cast: OpeningProps['cast']; onAnswer: () => void }) {
  const sound = useMissionSound()
  useEffect(() => {
    if (!sound) return
    playSting('call')
    const ring = window.setInterval(() => playSting('call'), RING_EVERY_MS)
    return () => window.clearInterval(ring)
  }, [sound])
  return (
    <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-center gap-4 py-4 text-center">
      <p className="rounded-full bg-grape-900/50 px-4 py-1 text-sm font-bold uppercase tracking-wide">Incoming video call</p>
      <div className="relative grid place-items-center p-6">
        {!calm &&
          [0, 1].map((ring) => (
            <motion.span
              key={ring}
              aria-hidden
              className="absolute size-28 rounded-full border-4 border-white/70"
              animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: ring * 0.8 }}
            />
          ))}
        <Face buddy={false} name={caller} cast={cast} size={96} />
      </div>
      <div className="rounded-2xl bg-grape-900/50 px-4 py-2">
        <p className="break-words font-display text-2xl font-semibold">{caller} is calling…</p>
        <p className="break-words text-sm font-semibold">about {title}</p>
      </div>
      <button
        type="button"
        onClick={onAnswer}
        autoFocus
        className="flex min-h-14 items-center gap-2 rounded-full bg-correct px-8 font-display text-lg font-bold text-white shadow-press focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
      >
        <Phone weight="fill" className="size-6" aria-hidden />
        Answer
      </button>
    </motion.div>
  )
}

function Chat({ caller, hook, goal, lines, cast, count, telling, onStart, onShown, calm }: OpeningProps & { caller: string }) {
  useShown(onShown)
  const shown = useArriving(lines.length, calm)
  const done = shown >= lines.length
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-grape-900/50 px-3 py-2">
        <Face buddy={false} name={caller} cast={cast} size={40} />
        <p className="min-w-0 flex-1 break-words font-bold">{caller}</p>
        <VideoCamera weight="fill" className="size-6 shrink-0" aria-hidden />
      </div>
      {hook && <p className="break-words rounded-2xl bg-grape-900/60 px-3 py-2 italic"><Said text={hook} /></p>}
      <ol className="space-y-2" aria-live="polite">
        {lines.slice(0, shown).map((line, n) => (
          <Bubble key={n} line={line} cast={cast} calm={calm} />
        ))}
      </ol>
      {!done && <Typing />}
      {done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 rounded-2xl bg-surface p-3 text-foreground">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{islandsToExplore(count)}</p>
          <Goal goal={goal} />
          <Footer telling={telling} onStart={onStart} />
        </motion.div>
      )}
    </motion.div>
  )
}

function Bubble({ line, cast, calm }: { line: OpeningProps['lines'][number]; cast: OpeningProps['cast']; calm: boolean }) {
  const { buddy, name } = speakerOf(line, cast)
  return (
    <motion.li
      initial={calm ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn('flex items-end gap-2', buddy && 'flex-row-reverse')}
    >
      <Face buddy={buddy} name={name} cast={cast} size={36} />
      <div className={cn('min-w-0 rounded-2xl px-3 py-2 text-foreground', buddy ? 'rounded-br-sm bg-selected' : 'rounded-bl-sm bg-surface')}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{name}</p>
        <p className="break-words text-lg"><Said text={told(line.says, cast.buddyName)} /></p>
      </div>
    </motion.li>
  )
}

function Typing() {
  return (
    <p className="flex w-fit items-center gap-1 rounded-full bg-surface px-3 py-2" aria-label="typing">
      {[0, 1, 2].map((dot) => (
        <motion.span key={dot} className="size-2 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: dot * 0.2 }} />
      ))}
    </p>
  )
}

/** How many of `total` lines are in by now: one more every moment, or all at once when calm. */
function useArriving(total: number, calm: boolean): number {
  const [shown, setShown] = useState(calm ? total : 0)
  useEffect(() => {
    if (shown >= total) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? LINE_MS / 2 : LINE_MS)
    return () => window.clearTimeout(timer)
  }, [shown, total])
  return shown
}
