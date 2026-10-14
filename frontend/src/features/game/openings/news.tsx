/**
 * The news-flash opening (§26.8): a TV news report from the game's world —
 * a "Breaking news" banner, the game's title as the headline, the story's
 * character on the scene with what they have to say, and the goal running
 * along the ticker. When calm, the ticker stands still.
 */
import { motion } from 'motion/react'
import { Broadcast } from '@phosphor-icons/react'
import { told } from '../cards'
import { paint, WORLDS } from '../worlds'
import { Face, Footer, Goal, Scene, islandsToExplore, speakerOf, useShown, type OpeningProps } from './parts'
import { Said } from '../mission/narration'

export function NewsOpening({ title, hook, goal, lines, cast, count, telling, onStart, onShown, world, calm }: OpeningProps) {
  useShown(onShown)
  return (
    <Scene calm={calm}>
      <div className="overflow-hidden bg-grape-900 text-white">
        <div className="flex flex-wrap items-center gap-2 bg-sun-400 px-4 py-2 text-grape-900">
          <Broadcast weight="fill" className="size-5" aria-hidden />
          <p className="font-display text-lg font-bold uppercase tracking-wide">Breaking news</p>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-grape-900 px-3 py-0.5 text-xs font-bold uppercase text-white">
            <motion.span aria-hidden className="size-2 rounded-full bg-coral-400" animate={calm ? undefined : { opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            Live
          </span>
        </div>
        <div className="space-y-3 px-4 py-4" style={{ background: `linear-gradient(180deg, ${paint(world, 'far')}, ${paint(world, 'haze')})` }}>
          <h2 className="break-words rounded-xl bg-grape-900/70 px-3 py-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2>
          {hook && <p className="break-words rounded-xl bg-grape-900/70 px-3 py-2 text-lg"><Said text={hook} /></p>}
          <p className="w-fit rounded-full bg-surface px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">On the scene: {WORLDS[world].label}</p>
          <ul className="space-y-2">
            {lines.map((line, n) => (
              <Quote key={n} line={line} cast={cast} />
            ))}
          </ul>
        </div>
        <Ticker text={`${goal} • ${islandsToExplore(count)}`} calm={calm} />
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        <Goal goal={goal} />
        <Footer telling={telling} onStart={onStart} />
      </div>
    </Scene>
  )
}

function Quote({ line, cast }: { line: OpeningProps['lines'][number]; cast: OpeningProps['cast'] }) {
  const { buddy, name } = speakerOf(line, cast)
  return (
    <li className="flex items-start gap-2 rounded-2xl bg-surface p-2 text-foreground">
      <Face buddy={buddy} name={name} cast={cast} size={40} />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{name}</p>
        <p className="break-words text-lg">“<Said text={told(line.says, cast.buddyName)} />”</p>
      </div>
    </li>
  )
}

/** The goal along the bottom of the screen, as news tickers run. Read once by
 *  a screen reader; the copy that makes the loop seamless is hidden. */
function Ticker({ text, calm }: { text: string; calm: boolean }) {
  if (calm) return <p className="break-words bg-grape-800 px-4 py-2 font-bold">{text}</p>
  return (
    <div className="overflow-hidden bg-grape-800 py-2 font-bold">
      <span className="sr-only">{text}</span>
      <motion.div aria-hidden className="flex w-max gap-12 whitespace-nowrap px-4" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}>
        <span>{text}</span>
        <span>{text}</span>
      </motion.div>
    </div>
  )
}
