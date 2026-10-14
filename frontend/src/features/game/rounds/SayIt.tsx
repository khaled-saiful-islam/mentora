/**
 * Say It (§28.3.5, Year 1–3): read a line aloud, and watch each word light
 * green as it is heard. A word missed is said again by the tutor's voice —
 * "Listen, then try: pe-ta-ni" — and the child tries once more. After three
 * tries the round moves on anyway: reading is learnt, not passed.
 *
 * With no microphone (none, or not allowed), the child taps each word as
 * they say it, so the round can always be played.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Check, Microphone, SpeakerHigh, Stop } from '@phosphor-icons/react'
import { createContext, useContext, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { pop, spring } from '@/motion'
import { useRecorder } from '@/features/voice/useRecorder'
import { SIZE, useFinish, useLater, useShowMe } from './parts'
import { matchWords, syllables, wordsOf, type WordHeard } from './say'
import type { RoundProps, SayContent } from './types'

/** What a Say It needs from the game it is in: an ear, and the voice for one word. */
export interface SayItHelp {
  language: string
  hear: (line: number, wav: Blob) => Promise<string>
  /** Says word `n`, counted across the lines, in the tutor's voice. */
  word: (n: number, text: string) => void
}

export const SayItContext = createContext<SayItHelp | null>(null)

// A preview or a test: heard, kept nowhere, and no voice for a word.
const plain: SayItHelp = {
  language: 'en',
  hear: async (_line, wav) => {
    const form = new FormData()
    form.append('clip', wav, 'reading.wav')
    return (await apiFetch<{ text: string }>('/voice/transcribe', { method: 'POST', body: form })).text
  },
  word: () => undefined,
}

const MOST_TRIES = 3
const NEXT_LINE_MS = 1400

export function SayIt({ content, band, calm, say, sound, showMe, onMove, onDone }: RoundProps<SayContent>) {
  const help = useContext(SayItContext) ?? plain
  const lines = content.lines
  const [at, setAt] = useState(0)
  const [heard, setHeard] = useState<WordHeard[] | null>(null)
  const [tries, setTries] = useState(0)
  const [trouble, setTrouble] = useState<string | null>(null)
  const later = useLater()
  const line = lines[at] ?? null
  const words = line ? wordsOf(line.text) : []
  useFinish(lines.length > 0 && at >= lines.length, onDone)

  function nextLine() {
    later(() => {
      setAt((n) => n + 1)
      setHeard(null)
      setTries(0)
    }, NEXT_LINE_MS)
  }

  function judge(result: WordHeard[]) {
    if (!line) return
    setHeard(result)
    const all = result.every((w) => w.heard)
    onMove({ piece: line.id, right: all })
    if (all) {
      sound('correct')
      nextLine()
      return
    }
    sound('tap')
    const missed = result.findIndex((w) => !w.heard)
    const offset = lines.slice(0, at).reduce((n, l) => n + wordsOf(l.text).length, 0)
    say(`Listen, then try: ${syllables(result[missed].word, help.language)}`)
    help.word(offset + missed, result[missed].word)
    if (tries + 1 >= MOST_TRIES) nextLine()
    setTries((n) => n + 1)
  }

  const recorder = useRecorder(async (wav) => {
    setTrouble(null)
    try {
      judge(matchWords(line?.text ?? '', await help.hear(at, wav)))
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : "That couldn't be heard. Try again.")
    }
  })
  const noMic = recorder.state === 'unsupported' || recorder.state === 'denied'

  useShowMe(showMe, () => line && say(line.text))

  function tapWord(n: number) {
    if (!line || !noMic) return
    const now = words.map((word, i) => ({ word, heard: (heard?.[i]?.heard ?? false) || i === n }))
    setHeard(now)
    sound('tap')
    if (now.every((w) => w.heard)) judge(now)
  }

  if (!line) return <Done />
  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <Progress count={lines.length} at={at} />
        <motion.section key={line.id} initial={calm ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} aria-label={`Line ${at + 1} of ${lines.length}`} className="w-full rounded-[2rem] bg-surface/95 p-5 shadow-sm sm:p-8">
          {line.icon && <p className="text-5xl" aria-hidden>{line.icon}</p>}
          <p className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-2" aria-live="polite">
            {words.map((word, n) => (
              <Word key={`${line.id}-${n}`} word={word} state={heard ? (heard[n]?.heard ? 'heard' : 'missed') : 'waiting'} band={band} calm={calm} delay={n * 0.12} onTap={noMic ? () => tapWord(n) : undefined} />
            ))}
          </p>
        </motion.section>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => say(line.text)} className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border bg-surface px-5 font-bold hover:bg-hover">
            <SpeakerHigh weight="fill" className="size-5" aria-hidden />
            Listen
          </button>
          {!noMic && <Mic state={recorder.state} level={recorder.level} calm={calm} onTap={() => void recorder.toggle()} />}
        </div>
        <p className="min-h-6 break-words font-semibold text-muted-foreground">
          {noMic ? 'Say each word, and tap it as you go.' : trouble ?? (recorder.state === 'listening' ? 'Read it out loud, then tap again.' : recorder.state === 'working' ? 'Listening to you…' : 'Tap the microphone and read it out loud.')}
        </p>
      </div>
    </div>
  )
}

type WordState = 'waiting' | 'heard' | 'missed'

function Word({ word, state, band, calm, delay, onTap }: { word: string; state: WordState; band: RoundProps<SayContent>['band']; calm: boolean; delay: number; onTap?: () => void }) {
  const Tag = onTap ? motion.button : motion.span
  return (
    <Tag
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      initial={false}
      animate={state === 'heard' && !calm ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'rounded-2xl border-2 px-3 py-1 font-display font-semibold transition-colors',
        band === 'early' ? 'text-3xl sm:text-4xl' : SIZE[band].piece,
        state === 'heard' && 'border-correct bg-correct-soft text-foreground',
        state === 'missed' && 'border-dashed border-coral-400 bg-coral-100/60 dark:bg-coral-700/20',
        state === 'waiting' && 'border-transparent',
      )}
    >
      {word}
    </Tag>
  )
}

function Mic({ state, level, calm, onTap }: { state: string; level: number; calm: boolean; onTap: () => void }) {
  const listening = state === 'listening'
  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={state === 'working'}
      aria-label={listening ? 'Stop: I said it' : 'Tap and read it out loud'}
      aria-pressed={listening}
      animate={listening && !calm ? { scale: 1 + level * 0.4 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className={cn('grid size-20 place-items-center rounded-full text-white shadow-press disabled:opacity-60', listening ? 'bg-coral-400' : 'bg-kind-live-vivid')}
    >
      {listening ? <Stop weight="fill" className="size-9" /> : <Microphone weight="fill" className="size-9" />}
    </motion.button>
  )
}

function Progress({ count, at }: { count: number; at: number }) {
  return (
    <ol className="flex gap-2" aria-label={`Line ${Math.min(at + 1, count)} of ${count}`}>
      {Array.from({ length: count }, (_, n) => (
        <li key={n} className={cn('grid size-8 place-items-center rounded-full border-2 text-sm font-bold', n < at ? 'border-correct bg-correct text-white' : n === at ? 'border-primary bg-selected' : 'border-border bg-surface')}>
          {n < at ? <Check weight="bold" className="size-4" aria-hidden /> : n + 1}
        </li>
      ))}
    </ol>
  )
}

function Done() {
  return (
    <AnimatePresence>
      <motion.p variants={pop} initial="hidden" animate="shown" className="grid h-full place-items-center font-celebrate text-4xl">
        Well read!
      </motion.p>
    </AnimatePresence>
  )
}
