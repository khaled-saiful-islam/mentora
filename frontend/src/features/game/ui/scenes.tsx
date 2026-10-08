/**
 * The story around the challenges (§23): the cover, the opening scene, each
 * chapter's intro and its end, and the finale. Each is a card over the world
 * with the story's words — `{buddy}` already swapped for the player's buddy —
 * read aloud in Astra's voice while the words show, so a child who cannot
 * read yet still hears the story.
 */
import { motion } from 'motion/react'
import { ArrowRight, Crown, Flag, Play, SpeakerHigh, Star, Stop } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { pop, rise, spring, stagger } from '@/motion'

const card = 'mx-auto w-full max-w-2xl rounded-3xl border-4 border-surface bg-surface/95 p-5 text-center shadow-lg backdrop-blur-sm sm:p-8'

export interface Telling {
  reading: boolean
  readable: boolean
  /** Read these words aloud, or stop if they are being read. */
  toggle: () => void
}

function Listen({ telling }: { telling: Telling }) {
  if (!telling.readable) return null
  return (
    <Button variant="ghost" size="sm" onClick={telling.toggle} aria-pressed={telling.reading}>
      {telling.reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
      {telling.reading ? 'Stop' : 'Listen'}
    </Button>
  )
}

/** Paragraphs as the story wrote them. */
function Told({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('space-y-3 break-words text-lg leading-relaxed sm:text-xl', className)}>
      {text.split(/\n\n+/).map((part, i) => (
        <p key={i}>{part}</p>
      ))}
    </div>
  )
}

/** The cover and the opening: one tap to start (which is also what lets the
 *  music and the voice play), then the story's first scene. */
export function TitleScene(props: {
  title: string
  subtitle: string
  hook: string
  goal: string
  resuming: boolean
  telling: Telling
  onStart: () => void
  onBegin: () => void
}) {
  const { title, subtitle, hook, goal, resuming, telling, onStart, onBegin } = props
  const [opened, setOpened] = useState(false)
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => go.current?.focus(), [opened])

  if (!opened) {
    return (
      <motion.div className={card} variants={stagger(0.08)} initial="hidden" animate="shown">
        <motion.p variants={rise} className="font-display text-sm font-bold uppercase tracking-wider text-primary">
          {subtitle}
        </motion.p>
        <motion.h1 variants={pop} className="mt-2 break-words font-celebrate text-4xl leading-tight sm:text-6xl">
          {title}
        </motion.h1>
        <motion.div variants={rise} className="mt-8">
          <Button
            ref={go}
            variant="sun"
            size="lg"
            onClick={() => {
              onStart()
              if (resuming) onBegin()
              else setOpened(true)
            }}
          >
            <Play weight="fill" className="size-5" />
            {resuming ? 'Carry on' : 'Start the adventure'}
          </Button>
        </motion.div>
      </motion.div>
    )
  }
  return (
    <StoryCard key="hook" icon={<Flag weight="fill" className="size-6" />} heading={title} text={hook} goal={goal} telling={telling} action="Let's go!" onAction={onBegin} />
  )
}

export function ChapterScene({ number, total, title, intro, telling, onGo }: { number: number; total: number; title: string; intro: string; telling: Telling; onGo: () => void }) {
  const last = number === total && total > 1
  return (
    <StoryCard
      key={`chapter-${number}`}
      icon={last ? <Crown weight="fill" className="size-6" /> : <span className="font-display text-xl font-bold">{number}</span>}
      eyebrow={last ? 'The final chapter' : `Chapter ${number} of ${total}`}
      heading={title}
      text={intro}
      telling={telling}
      action={last ? 'Face the final challenge' : "Let's go!"}
      onAction={onGo}
    />
  )
}

export function ChapterEndScene(props: {
  number: number
  title: string
  outro: string
  stars: number
  correct: number
  total: number
  last: boolean
  calm: boolean
  telling: Telling
  onStar: () => void
  onNext: () => void
}) {
  const { number, title, outro, stars, correct, total, last, calm, telling, onStar, onNext } = props
  return (
    <StoryCard
      key={`end-${number}`}
      eyebrow={`Chapter ${number} complete`}
      heading={title}
      text={outro}
      telling={telling}
      action={last ? 'To the finale' : 'Next chapter'}
      onAction={onNext}
    >
      <div className="mt-4 flex justify-center gap-3" aria-label={`${stars} of 3 stars`}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={calm ? false : { scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...spring.bouncy, delay: calm ? 0 : 0.25 + i * 0.35 }}
            onAnimationStart={() => i < stars && onStar()}
          >
            <Star weight={i < stars ? 'fill' : 'regular'} className={cn('size-14', i < stars ? 'text-star drop-shadow' : 'text-muted-foreground')} />
          </motion.span>
        ))}
      </div>
      <p className="mt-2 font-display text-lg font-semibold text-muted-foreground">
        {correct} of {total} right
      </p>
    </StoryCard>
  )
}

export function FinaleScene({ title, win, telling, onFinish, children }: { title: string; win: string; telling: Telling; onFinish: () => void; children?: React.ReactNode }) {
  return (
    <StoryCard key="finale" icon={<Crown weight="fill" className="size-6" />} eyebrow="The end" heading={title} text={win} telling={telling} action="See my points" onAction={onFinish}>
      {children}
    </StoryCard>
  )
}

function StoryCard(props: {
  icon?: React.ReactNode
  eyebrow?: string
  heading: string
  text: string
  goal?: string
  telling: Telling
  action: string
  onAction: () => void
  children?: React.ReactNode
}) {
  const { icon, eyebrow, heading, text, goal, telling, action, onAction, children } = props
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => go.current?.focus(), [])
  return (
    <motion.div className={card} variants={stagger(0.08)} initial="hidden" animate="shown">
      {icon && (
        <motion.div variants={pop} className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
          {icon}
        </motion.div>
      )}
      {eyebrow && (
        <motion.p variants={rise} className="mt-3 font-display text-sm font-bold uppercase tracking-wider text-primary">
          {eyebrow}
        </motion.p>
      )}
      <motion.h2 variants={rise} className="mt-1 break-words font-celebrate text-3xl leading-tight sm:text-4xl">
        {heading}
      </motion.h2>
      {text && (
        <motion.div variants={rise}>
          <Told text={text} className="mt-4" />
        </motion.div>
      )}
      {goal && (
        <motion.p variants={rise} className="mx-auto mt-4 inline-flex max-w-full items-start gap-2 rounded-2xl bg-star-soft px-4 py-2 text-left font-semibold">
          <Flag weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" />
          <span className="min-w-0 break-words">{goal}</span>
        </motion.p>
      )}
      {children}
      <motion.div variants={rise} className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Listen telling={telling} />
        <Button ref={go} variant="sun" size="lg" onClick={onAction}>
          {action}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </motion.div>
    </motion.div>
  )
}
