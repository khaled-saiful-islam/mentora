/**
 * The letter-in-a-bottle opening (§26.8): a bottle bobs in on the waves of
 * the game's world. Opened, a letter unrolls — the story's character writing
 * to the player, the buddy adding a line or two, a P.S. with what to do — and
 * it is signed. When calm, nothing bobs and the letter simply appears.
 */
import { AnimatePresence, motion } from 'motion/react'
import { EnvelopeOpen } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { told } from '../cards'
import { paint, WORLDS } from '../worlds'
import { Face, Footer, Goal, Scene, islandsToExplore, speakerOf, type OpeningProps } from './parts'

export function LetterOpening(props: OpeningProps) {
  const [open, setOpen] = useState(false)
  return (
    <Scene calm={props.calm}>
      <AnimatePresence mode="wait" initial={false}>
        {open ? <Letter key="letter" {...props} /> : <Sea key="sea" world={props.world} title={props.title} calm={props.calm} onOpen={() => setOpen(true)} />}
      </AnimatePresence>
    </Scene>
  )
}

function Sea({ world, title, calm, onOpen }: { world: OpeningProps['world']; title: string; calm: boolean; onOpen: () => void }) {
  return (
    <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative flex flex-col items-center gap-4 overflow-hidden px-5 pb-6 pt-8 text-center" style={{ background: `linear-gradient(180deg, ${paint(world, 'sky')}, ${paint(world, 'haze')})` }}>
      <p className="rounded-2xl bg-surface/90 px-4 py-2 font-display text-xl font-semibold">A bottle has washed up in the {WORLDS[world].label.toLowerCase()}!</p>
      <motion.div
        aria-hidden
        animate={calm ? undefined : { y: [0, -10, 0], rotate: [-8, 6, -8] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 py-2"
      >
        <Bottle world={world} />
      </motion.div>
      <Waves world={world} calm={calm} />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="break-words rounded-full bg-surface/90 px-4 py-1 font-semibold">There is a letter inside: {title}</p>
        <Button variant="sun" size="lg" onClick={onOpen} autoFocus>
          <EnvelopeOpen weight="fill" className="size-5" />
          Open the bottle
        </Button>
      </div>
    </motion.div>
  )
}

function Bottle({ world }: { world: OpeningProps['world'] }) {
  return (
    <svg viewBox="0 0 120 64" className="h-20 w-36">
      <rect x="10" y="14" width="78" height="36" rx="16" fill={paint(world, 'glow')} fillOpacity="0.55" stroke={paint(world, 'accent')} strokeWidth="3" />
      <rect x="86" y="24" width="20" height="16" rx="5" fill={paint(world, 'glow')} fillOpacity="0.55" stroke={paint(world, 'accent')} strokeWidth="3" />
      <rect x="104" y="25" width="10" height="14" rx="3" fill={paint(world, 'ground')} />
      <rect x="26" y="22" width="44" height="20" rx="6" fill="hsl(var(--sun-100))" stroke="hsl(var(--sun-600))" strokeWidth="1.5" />
      <path d="M32 29h32M32 35h24" stroke="hsl(var(--sun-600))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Waves({ world, calm }: { world: OpeningProps['world']; calm: boolean }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 400 40"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-[52%] h-10 w-full"
      animate={calm ? undefined : { x: [0, -20, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M0 20 Q 25 5 50 20 T 100 20 T 150 20 T 200 20 T 250 20 T 300 20 T 350 20 T 400 20 V40 H0 Z" fill={paint(world, 'accent')} fillOpacity="0.45" />
    </motion.svg>
  )
}

function Letter({ title, hook, goal, lines, cast, count, telling, onStart, calm }: OpeningProps) {
  const writer = cast.character || cast.buddyName
  return (
    <motion.div
      initial={calm ? { opacity: 0 } : { opacity: 0, scaleY: 0.2 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: calm ? 0.2 : 0.5 }}
      style={{ transformOrigin: 'top' }}
      className="space-y-4 p-5 sm:p-6"
    >
      <div className="space-y-3 rounded-2xl border-2 border-sun-300 bg-sun-100 px-4 py-4 text-grape-900 shadow-sm sm:-rotate-1 dark:bg-sun-100">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{title}</p>
        <p className="font-display text-xl italic">Dear friend,</p>
        {hook && <p className="break-words font-display text-lg italic">{hook}</p>}
        <ul className="space-y-2">
          {lines.map((line, n) => (
            <LetterLine key={n} line={line} cast={cast} />
          ))}
        </ul>
        <p className="text-right font-display text-xl italic">— {writer}</p>
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-primary">{islandsToExplore(count)}</p>
      <Goal goal={goal} label="P.S." />
      <Footer telling={telling} onStart={onStart} />
    </motion.div>
  )
}

function LetterLine({ line, cast }: { line: OpeningProps['lines'][number]; cast: OpeningProps['cast'] }) {
  const { buddy, name } = speakerOf(line, cast)
  return (
    <li className={cn('flex items-start gap-2', buddy && 'rounded-xl bg-surface/70 p-2')}>
      <Face buddy={buddy} name={name} cast={cast} size={32} />
      <p className="min-w-0 break-words font-display text-lg italic">
        <span className="not-italic font-bold">{name}: </span>
        {told(line.says, cast.buddyName)}
      </p>
    </li>
  )
}
