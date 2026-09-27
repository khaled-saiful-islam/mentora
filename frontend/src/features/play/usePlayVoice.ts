/**
 * Read it to me, in the tutor's voice — the warm one that teaches live
 * lessons.
 *
 * Each line (the question, then each answer by its shape) is its own clip
 * from the server, played one after another with a breath between, so a
 * question and its four answers don't run together. Every clip is asked for
 * at once, so the next one is usually ready by its turn.
 *
 * Where the tutor's voice can't be had — a language it doesn't read yet, or
 * the voice service down — the browser's own voice reads the same words, so
 * the button always does something.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReadAloud } from '@/features/guide/useReadAloud'
import { useConfig } from '@/hooks/useConfig'
import { audioContext } from '@/lib/audio'
import { usePlayBackend, type Spoken } from './backend'

export interface Line {
  spoken: Spoken
  /** The same words, for the browser's voice if the tutor's fails. */
  text: string
}

export interface PlayVoice {
  supported: boolean
  /** Which piece is being read, as the caller named it; null when quiet. */
  reading: string | null
  read: (key: string, lines: Line[]) => void
  stop: () => void
}

/** A breath between answers, and a longer one after the question. */
export const GAP_MS = 450
export const AFTER_QUESTION_MS = 800

export function gapAfter(line: Line): number {
  return line.spoken.part === 'question' ? AFTER_QUESTION_MS : GAP_MS
}

async function fetchClip(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url)
    return response.ok ? await response.arrayBuffer() : null
  } catch {
    // Offline, or the voice is down: the browser's voice takes over.
    return null
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** The lines as one passage for the browser's voice, each ending a sentence. */
export const joined = (lines: Line[]) => lines.map((l) => (/[.!?]$/.test(l.text.trim()) ? l.text.trim() : `${l.text.trim()}.`)).join(' ')

export function usePlayVoice(attemptId: string, language: string): PlayVoice {
  const backend = usePlayBackend()
  const config = useConfig()
  const browser = useReadAloud(language)
  const { read: browserRead, stop: browserStop } = browser
  const tutor = Boolean(config?.read_aloud_languages?.includes(language))
  const [reading, setReading] = useState<string | null>(null)
  // Each reading has a number; stopping moves it on, so a reading that was
  // stopped notices at its next step and goes quiet.
  const run = useRef(0)
  const source = useRef<AudioBufferSourceNode | null>(null)

  const hush = useCallback(() => {
    run.current += 1
    try {
      source.current?.stop()
    } catch {
      // It had already ended.
    }
    source.current = null
  }, [])

  const stop = useCallback(() => {
    hush()
    browserStop()
    setReading(null)
  }, [hush, browserStop])

  /** Plays one clip to its end; false if it could not be played. */
  const say = useCallback(async (ctx: AudioContext, bytes: ArrayBuffer, mine: number): Promise<boolean> => {
    const buffer = await ctx.decodeAudioData(bytes)
    if (run.current !== mine) return false
    return new Promise((resolve) => {
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(ctx.destination)
      node.onended = () => resolve(true)
      source.current = node
      node.start()
    })
  }, [])

  const read = useCallback(
    (key: string, lines: Line[]) => {
      stop()
      if (!lines.length) return
      const ctx = tutor ? audioContext() : null
      if (!ctx) {
        browserRead(key, joined(lines))
        return
      }
      const mine = run.current
      setReading(key)
      const clips = lines.map((line) => fetchClip(backend.speech(attemptId, line.spoken)))
      void (async () => {
        for (let i = 0; i < lines.length; i++) {
          const bytes = await clips[i]
          if (run.current !== mine) return
          const heard = bytes ? await say(ctx, bytes, mine).catch(() => false) : false
          if (run.current !== mine) return
          if (!heard) {
            // The rest in the browser's voice, rather than silence.
            setReading(null)
            browserRead(key, joined(lines.slice(i)))
            return
          }
          if (i < lines.length - 1) await sleep(gapAfter(lines[i]))
          if (run.current !== mine) return
        }
        setReading(null)
      })()
    },
    [stop, tutor, browserRead, backend, attemptId, say],
  )

  useEffect(() => hush, [hush])

  return { supported: tutor || browser.supported, reading: reading ?? browser.reading, read, stop }
}
