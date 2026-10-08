/**
 * Along the top of a game: the way out, the chapters with the stars won so
 * far, the points (with the combo, while it lasts), and the sound and
 * full-screen switches. Small, so the world shows.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowsIn, ArrowsOut, Fire, SpeakerHigh, SpeakerSlash, Star, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'

export interface HudProps {
  title: string
  exitTo: string
  /** Per chapter: stars won, or null while it is still to come. */
  chapterStars: (number | null)[]
  chapter: number | null
  points: number
  streak: number
  soundOn: boolean
  onSound: () => void
  fullscreen: boolean
  onFullscreen: (() => void) | null
}

const pill = 'flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 shadow backdrop-blur-sm'

export function Hud({ title, exitTo, chapterStars, chapter, points, streak, soundOn, onSound, fullscreen, onFullscreen }: HudProps) {
  return (
    <header className="relative z-20 flex flex-wrap items-center gap-2 p-2 sm:p-3">
      <Link to={exitTo} className={cn(pill, 'size-11 justify-center px-0')} aria-label="Leave the game — your answers are saved">
        <X weight="bold" className="size-5" />
      </Link>
      <p className={cn(pill, 'min-w-0 max-w-full font-display font-semibold')}>
        <span className="min-w-0 break-words">{title}</span>
      </p>
      <ol className={cn(pill, 'gap-2')} aria-label="Chapters">
        {chapterStars.map((stars, i) => (
          <li key={i} className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold', i === chapter && 'bg-selected')} aria-label={`Chapter ${i + 1}${stars === null ? '' : `: ${stars} stars`}`}>
            <span className="mr-0.5">{i + 1}</span>
            {[0, 1, 2].map((s) => (
              <Star key={s} weight={stars !== null && s < stars ? 'fill' : 'regular'} className={cn('size-3.5', stars !== null && s < stars ? 'text-star' : 'text-muted-foreground')} />
            ))}
          </li>
        ))}
      </ol>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <AnimatePresence>
          {streak >= 2 && (
            <motion.span key="combo" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.bouncy} className={cn(pill, 'font-display font-bold text-warning')}>
              <Fire weight="fill" className="size-5" />
              {streak} in a row
            </motion.span>
          )}
        </AnimatePresence>
        <span className={cn(pill, 'font-display text-lg font-bold tabular-nums')} aria-label={`${points} points`}>
          <Star weight="fill" className="size-5 text-star" />
          <motion.span key={points} initial={{ y: -8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={spring.snappy}>
            {points}
          </motion.span>
        </span>
        <button type="button" onClick={onSound} className={cn(pill, 'size-11 justify-center px-0')} aria-pressed={soundOn} aria-label={soundOn ? 'Sound off' : 'Sound on'}>
          {soundOn ? <SpeakerHigh weight="bold" className="size-5" /> : <SpeakerSlash weight="bold" className="size-5" />}
        </button>
        {onFullscreen && (
          <button type="button" onClick={onFullscreen} className={cn(pill, 'size-11 justify-center px-0')} aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}>
            {fullscreen ? <ArrowsIn weight="bold" className="size-5" /> : <ArrowsOut weight="bold" className="size-5" />}
          </button>
        )}
      </div>
    </header>
  )
}
