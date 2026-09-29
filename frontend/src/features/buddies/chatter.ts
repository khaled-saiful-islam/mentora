/**
 * The buddy keeping a student company on their home page: now and then it
 * says something useful — what is waiting, a streak worth keeping, a fun fact
 * of its own, an encouragement in its own voice, a study tip — and moves as
 * it talks. A handful of lines a visit, never while the tab is hidden, so it
 * is company and not a nag.
 *
 * Nothing it says is about a question's content, so it cannot give an answer
 * away.
 */
import { useEffect } from 'react'
import type { BuddyHandle } from './Buddy'
import { profileOf } from './profiles'
import { tipFor } from './tips'
import type { Mood } from './types'
import { pick, VOICES } from './voices'

export interface ChatterContext {
  /** Titles of what is waiting, soonest first. */
  todo: readonly string[]
  streak: number
  badges: number
  /** Skills worth practising. */
  practise: readonly string[]
  strengths: readonly string[]
  /** Practice made for them, waiting. */
  madeForYou: number
}

export interface Chatter {
  mood: Mood
  line: string
}

/** What the student's own day gives it to say, if anything. */
function about(ctx: ChatterContext, turn: number): string | null {
  const said = [
    ctx.todo.length === 1 && `You've got "${ctx.todo[0]}" waiting. Shall we start it together?`,
    ctx.todo.length > 1 && `${ctx.todo.length} things to do — let's start with "${ctx.todo[0]}"!`,
    ctx.madeForYou > 0 && `I made some practice just for you — find it under Made for you!`,
    ctx.streak >= 2 && `${ctx.streak} days in a row! Keep your streak going today.`,
    ctx.practise.length > 0 && `A little practice on ${ctx.practise[0]} would make you even stronger.`,
    ctx.badges > 0 && `You've earned ${ctx.badges} ${ctx.badges === 1 ? 'badge' : 'badges'} so far. Which one's next?`,
    ctx.strengths.length > 0 && `You're a star at ${ctx.strengths[0]}. That's something to be proud of!`,
  ].filter((line): line is string => Boolean(line))
  return said.length ? said[turn % said.length] : null
}

/** The line for this turn: the student's day, a fact, a cheer, a tip, in turn. */
export function chatterFor(buddy: string | null | undefined, ctx: ChatterContext, turn: number, seed = Math.random()): Chatter {
  const profile = profileOf(buddy)
  const voice = VOICES[profile.key]
  const habit = profile.antics[turn % profile.antics.length]
  switch (turn % 4) {
    case 0: {
      const line = about(ctx, Math.floor(turn / 4))
      if (line) return { mood: 'point', line }
      return { mood: habit, line: pick(voice.cheers, seed) }
    }
    case 1:
      return { mood: 'think', line: pick(voice.facts, seed) }
    case 2:
      return { mood: habit, line: pick(voice.cheers, seed) }
    default:
      return { mood: 'nod', line: tipFor('home', { practise: ctx.practise, strengths: ctx.strengths }, seed) }
  }
}

export const FIRST_AFTER_MS = 16_000
export const EVERY_MS = 26_000
export const MOST = 8

/** Chatter on a page while the student is on it: a line now and then. */
export function useBuddyChatter(
  buddy: React.RefObject<BuddyHandle | null>,
  key: string | null | undefined,
  context: ChatterContext | null,
  { first = FIRST_AFTER_MS, every = EVERY_MS, most = MOST }: { first?: number; every?: number; most?: number } = {},
): void {
  const ready = context !== null
  useEffect(() => {
    if (!ready || !context) return
    let turn = 0
    let timer = 0
    const next = (wait: number) => {
      timer = window.setTimeout(() => {
        // A hidden tab hears nothing; it tries again later rather than
        // saving up lines for when the child comes back.
        if (document.visibilityState === 'visible') {
          const { mood, line } = chatterFor(key, context, turn)
          buddy.current?.play(mood)
          buddy.current?.say(line)
          turn += 1
        }
        if (turn < most) next(every)
      }, wait)
    }
    next(first)
    return () => window.clearTimeout(timer)
    // The context is read when it first arrives; a live refresh must not
    // restart the conversation.
  }, [ready, key, buddy, first, every, most])
}
