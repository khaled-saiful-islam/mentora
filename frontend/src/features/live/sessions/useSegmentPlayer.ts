/**
 * Hearing one part of the lesson in the preview, exactly as the group will:
 * the same recorded clips, the same gaps, the same voice.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { speak, type VoiceChoice } from '../api'
import { SpeechQueue, type Clip } from '../audio/SpeechQueue'
import type { Silence } from '../audio/timing'
import type { Segment } from './api'

export function useSegmentPlayer(choice: VoiceChoice | null) {
  const queue = useRef<SpeechQueue | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [saying, setSaying] = useState<string | null>(null)

  const stop = useCallback(() => {
    const q = queue.current
    queue.current = null
    q?.clear()
    void q?.ctx.close().catch(() => undefined)
    setPlaying(null)
    setSaying(null)
  }, [])

  useEffect(() => stop, [stop])

  const play = useCallback(
    async (segment: Segment) => {
      if (!choice) return
      stop()
      const ctx = new AudioContext()
      await ctx.resume()
      const q = new SpeechQueue(ctx, {
        onStart: (heard) => setSaying(heard.clip.text),
        onIdle: () => {
          if (queue.current === q) stop()
        },
      })
      queue.current = q
      setPlaying(segment.id)
      const clips: Clip[] = segment.beats.flatMap((beat) => {
        const parts = beat.sentences.length ? beat.sentences : [beat.say]
        return parts.map((text, i) => ({
          id: `${beat.id}.${i}`,
          text,
          lane: 'lesson' as const,
          pause: (i < parts.length - 1 ? (/\?["')]*$/.test(text) ? 'breath' : 'sentence') : beat.pause) as Silence,
          audio: speak(text, choice).then((bytes) => ctx.decodeAudioData(bytes)),
        }))
      })
      q.add(...clips)
    },
    [choice, stop],
  )

  return { playing, saying, play, stop }
}
