/**
 * The game's sound, switched as one: music and effects through a single
 * volume, quiet unless the player's sound is on (`prefs.sound` — on for
 * students, off for teachers) and the in-game speaker button agrees. Nothing
 * plays before the first tap; browsers refuse sound until then, which is why
 * the title screen asks for one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameStyle, GameWorld } from '@/features/learning/api'
import { audioContext } from '@/lib/audio'
import { usePreferences } from '@/lib/prefs'
import { Music } from './music'
import { playEffect, type Effect } from './sfx'

export interface GameAudio {
  on: boolean
  toggle: () => void
  /** Begin the music — call from a tap. */
  start: () => void
  setBoss: (on: boolean) => void
  effect: (effect: Effect, level?: number) => void
}

interface Rig {
  ctx: AudioContext
  out: GainNode
  music: Music
}

export function useGameAudio(world: GameWorld, style: GameStyle, seed: number): GameAudio {
  const { prefs } = usePreferences()
  const [on, setOn] = useState(prefs.sound)
  const rig = useRef<Rig | null>(null)
  const playing = useRef(false)

  const ensure = useCallback((): Rig | null => {
    if (rig.current) return rig.current
    const ctx = audioContext()
    if (!ctx) return null
    const out = ctx.createGain()
    out.connect(ctx.destination)
    rig.current = { ctx, out, music: new Music(ctx, out) }
    return rig.current
  }, [])

  const start = useCallback(() => {
    playing.current = true
    if (!on) return
    const ready = ensure()
    ready?.music.start(world, style, seed)
  }, [on, ensure, world, style, seed])

  const toggle = useCallback(() => {
    setOn((was) => {
      const now = !was
      const ready = ensure()
      if (!now) ready?.music.stop(0.3)
      else if (playing.current) ready?.music.start(world, style, seed)
      return now
    })
  }, [ensure, world, style, seed])

  const effect = useCallback(
    (name: Effect, level?: number) => {
      if (!on) return
      const ready = ensure()
      if (ready) {
        try {
          playEffect(ready.ctx, ready.out, name, level)
        } catch {
          // No audio here: a silent game is still a game.
        }
      }
    },
    [on, ensure],
  )

  const setBoss = useCallback((boss: boolean) => rig.current?.music.setBoss(boss), [])

  // A style or world switched while playing (a preview): the tune follows.
  useEffect(() => {
    if (playing.current && on) rig.current?.music.start(world, style, seed)
  }, [world, style, seed, on])

  useEffect(() => () => rig.current?.music.stop(0.2), [])

  return useMemo(() => ({ on, toggle, start, setBoss, effect }), [on, toggle, start, setBoss, effect])
}
