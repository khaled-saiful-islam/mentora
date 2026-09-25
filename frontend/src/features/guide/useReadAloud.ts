/**
 * Read a section out loud, with the browser's own voice.
 *
 * No service and no key: every browser a school has ships speech synthesis.
 * It says where it has got to, word by word, so the sentence being read can
 * light up — a child following along with their finger, on screen.
 */
import { useCallback, useEffect, useState } from 'react'

const VOICES: Record<string, string> = { en: 'en-GB', ms: 'ms-MY', ta: 'ta-IN', zh: 'zh-CN', bn: 'bn-IN' }

export interface ReadAloud {
  supported: boolean
  /** Which piece is being read, as the caller named it; null when quiet. */
  reading: string | null
  /** The character it has reached in that piece. */
  at: number
  read: (key: string, text: string) => void
  stop: () => void
}

function available(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function useReadAloud(language: string): ReadAloud {
  const supported = available()
  const [reading, setReading] = useState<string | null>(null)
  const [at, setAt] = useState(0)

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setReading(null)
    setAt(0)
  }, [supported])

  const read = useCallback(
    (key: string, text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = VOICES[language] ?? 'en-GB'
      // A touch slower and brighter than the default: it is for children.
      utterance.rate = 0.92
      utterance.pitch = 1.05
      utterance.onboundary = (event) => setAt(event.charIndex)
      // Cancelling one to start another ends the first; only the one still
      // being read may clear the state.
      const done = () => setReading((now) => (now === key ? null : now))
      utterance.onend = done
      utterance.onerror = done
      setAt(0)
      setReading(key)
      window.speechSynthesis.speak(utterance)
    },
    [supported, language],
  )

  useEffect(() => () => {
    if (available()) window.speechSynthesis.cancel()
  }, [])

  return { supported, reading, at, read, stop }
}
