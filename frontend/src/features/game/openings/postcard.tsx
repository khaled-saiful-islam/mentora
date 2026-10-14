/**
 * The postcard opening (§26.8): a postcard from the game's world — its
 * picture, a stamp, "Greetings from…" — that turns over, by a tap or after a
 * moment, to the message: the story, the lines from the character and the
 * buddy, and a P.S. with the goal. When calm it fades over instead of
 * flipping.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { told } from '../cards'
import { paint, WORLDS } from '../worlds'
import { Face, Footer, Goal, Scene, islandsToExplore, speakerOf, useShown, type OpeningProps } from './parts'
import { Said as Lit } from '../mission/narration'

// Long enough to look at the picture; a tap turns it sooner.
const TURN_AFTER_MS = 3500

// A few things that live in each world, for the picture side.
const SCENERY: Record<OpeningProps['world'], string[]> = {
  rainforest: ['🌳', '🦜', '🐒', '🌺'],
  reef: ['🐠', '🐢', '🪸', '🐚'],
  kampung: ['🏮', '🪁', '🏠', '🌴'],
  city: ['🏙️', '🚝', '🌃', '🎆'],
  space: ['🚀', '🪐', '🌙', '⭐'],
}

export function PostcardOpening(props: OpeningProps) {
  const [turned, setTurned] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setTurned(true), TURN_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [])
  const turn = props.calm ? { opacity: 0 } : { rotateY: 90, opacity: 0.6 }
  return (
    <Scene calm={props.calm} className="[perspective:1200px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={turned ? 'back' : 'front'} initial={turn} animate={{ rotateY: 0, opacity: 1 }} exit={turn} transition={{ duration: props.calm ? 0.2 : 0.35 }}>
          {turned ? <Message {...props} /> : <Picture {...props} onTurn={() => setTurned(true)} />}
        </motion.div>
      </AnimatePresence>
    </Scene>
  )
}

function Picture({ title, world, count, onTurn }: OpeningProps & { onTurn: () => void }) {
  return (
    <div className="relative flex min-h-80 flex-col justify-between gap-4 p-5 sm:p-6" style={{ background: `linear-gradient(160deg, ${paint(world, 'sky')}, ${paint(world, 'mid')} 75%, ${paint(world, 'ground')})` }}>
      <Stamp world={world} count={count} />
      <p aria-hidden className="flex flex-wrap gap-2 pr-28 text-5xl leading-none sm:text-6xl">
        {SCENERY[world].map((thing) => (
          <span key={thing}>{thing}</span>
        ))}
      </p>
      <div className="space-y-3">
        <p className="w-fit max-w-full break-words rounded-2xl bg-surface/90 px-4 py-2 font-display text-2xl font-semibold">Greetings from the {WORLDS[world].label.toLowerCase()}!</p>
        <p className="w-fit max-w-full break-words rounded-full bg-surface/90 px-4 py-1 font-semibold">{title}</p>
        <Button variant="sun" size="lg" onClick={onTurn} autoFocus>
          <ArrowsClockwise weight="bold" className="size-5" />
          Turn it over
        </Button>
      </div>
    </div>
  )
}

function Stamp({ world, count }: { world: OpeningProps['world']; count: number }) {
  return (
    <div className="absolute right-4 top-4 grid w-24 rotate-3 place-items-center gap-1 rounded-md border-4 border-dashed border-surface bg-surface/90 px-2 py-2 text-center shadow-sm">
      <span aria-hidden className="text-3xl leading-none">{SCENERY[world][0]}</span>
      <span className="font-display text-xs font-bold leading-tight">{islandsToExplore(count)}</span>
    </div>
  )
}

function Message({ title, hook, goal, lines, cast, count, telling, onStart, onShown, world }: OpeningProps) {
  useShown(onShown)
  const writer = cast.character || cast.buddyName
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{title}</p>
          {hook && <p className="break-words font-display text-lg italic"><Lit text={hook} /></p>}
          <ul className="space-y-2">
            {lines.map((line, n) => (
              <Said key={n} line={line} cast={cast} />
            ))}
          </ul>
          <p className="font-display text-lg italic">— {writer}</p>
        </div>
        <div aria-hidden className="hidden w-28 space-y-3 border-l-2 border-dashed border-border pl-4 pt-1 sm:block">
          <span className="ml-auto grid size-14 rotate-3 place-items-center rounded-md border-4 border-dashed border-sun-300 text-3xl">{SCENERY[world][0]}</span>
          <span className="block h-0.5 bg-border" />
          <span className="block h-0.5 bg-border" />
          <span className="block h-0.5 bg-border" />
        </div>
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-primary">{islandsToExplore(count)}</p>
      <Goal goal={goal} label="P.S." />
      <Footer telling={telling} onStart={onStart} />
    </div>
  )
}

function Said({ line, cast }: { line: OpeningProps['lines'][number]; cast: OpeningProps['cast'] }) {
  const { buddy, name } = speakerOf(line, cast)
  return (
    <li className="flex items-start gap-2">
      <Face buddy={buddy} name={name} cast={cast} size={32} />
      <p className="min-w-0 break-words text-lg">
        <span className="font-bold">{name}: </span>
        <Lit text={told(line.says, cast.buddyName)} />
      </p>
    </li>
  )
}
