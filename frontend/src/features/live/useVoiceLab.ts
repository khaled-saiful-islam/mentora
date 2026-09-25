/**
 * The voice lab's lesson, run in the browser: the beats said one after
 * another, a hand raised part-way, the student called on, the answer spoken
 * as it streams in, and the lesson picking up again where it stopped.
 *
 * This is the live session's flow on one screen, so what the teacher hears
 * here is exactly what a group will hear (PLAN.md §19.2).
 *
 * The speech queue calls back from outside React, so everything those
 * callbacks read lives in refs; state is only what the screen shows.
 */
import { useMotionValue } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { askTutor, speak, warmTutor, writeLesson, type Lesson, type VoiceChoice } from './api'
import type { Spoken } from './Captions'
import { SpeechQueue, type Clip, type Heard, type Lane } from './audio/SpeechQueue'
import type { Silence } from './audio/timing'

export type Phase =
  | 'setup' // nothing written yet
  | 'writing' // the model is writing the lesson
  | 'ready' // written, not started
  | 'teaching'
  | 'paused'
  | 'hand' // a hand is up; the tutor is finishing the beat
  | 'called' // the student has the floor
  | 'answering'
  | 'finished'

export interface Said {
  id: string
  speaker: 'tutor' | 'student'
  name?: string
  text: string
}

// After an answer, a breath before the lesson carries on.
const RESUME_AFTER_MS = 650

interface Session {
  queue: SpeechQueue | null
  lesson: Lesson | null
  topic: string
  grade: string | null
  beat: number
  asker: string | null
  phase: Phase
  /** Answer clips still to be heard, and whether the answer has finished arriving. */
  answer: { pending: number; done: boolean }
  choice: VoiceChoice
  serial: number
}

export function useVoiceLab(choice: VoiceChoice) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [line, setLine] = useState<Spoken | null>(null)
  const [beat, setBeat] = useState(-1)
  const [speaking, setSpeaking] = useState(false)
  const [asker, setAsker] = useState<string | null>(null)
  const [said, setSaid] = useState<Said[]>([])
  const level = useMotionValue(0)

  const s = useRef<Session>({
    queue: null,
    lesson: null,
    topic: '',
    grade: null,
    beat: -1,
    asker: null,
    phase: 'setup',
    answer: { pending: 0, done: true },
    choice,
    serial: 0,
  })
  s.current.choice = choice

  const move = useCallback((next: Phase) => {
    s.current.phase = next
    setPhase(next)
  }, [])

  const nextId = (prefix: string) => `${prefix}-${(s.current.serial += 1)}`

  const clip = useCallback((id: string, text: string, lane: Lane, pause: Silence): Clip => {
    const queue = s.current.queue
    if (!queue) throw new Error('The voice is not ready.')
    const audio = speak(text, s.current.choice).then((bytes) => queue.ctx.decodeAudioData(bytes))
    return { id, text, lane, pause, audio }
  }, [])

  const taught = useCallback(() => {
    const { lesson: made, beat: at } = s.current
    return (made?.beats ?? []).slice(0, Math.max(1, at + 1)).map((b) => b.say)
  }, [])

  const callOn = useCallback(() => {
    const { queue, asker: name, lesson: made } = s.current
    const lines = name ? made?.lines[name] : undefined
    if (!queue || !lines) return
    queue.add(clip(nextId('call'), lines.call, 'tutor', 'short'))
  }, [clip])

  const resumeLesson = useCallback(() => {
    s.current.asker = null
    setAsker(null)
    move('teaching')
    window.setTimeout(() => s.current.queue?.release(), RESUME_AFTER_MS)
  }, [move])

  const onStart = useCallback((heard: Heard) => {
    const { clip: c } = heard
    setSpeaking(true)
    setLine({ key: c.id, text: c.text, start: heard.start, duration: heard.duration, speaker: 'tutor' })
    setSaid((all) => [...all, { id: c.id, speaker: 'tutor', text: c.text }])
    if (c.lane === 'lesson') {
      const index = s.current.lesson?.beats.findIndex((b) => b.id === c.id) ?? -1
      if (index >= 0) {
        s.current.beat = index
        setBeat(index)
      }
    }
  }, [])

  const onEnd = useCallback(
    (heard: Heard) => {
      setSpeaking(false)
      const id = heard.clip.id
      if (id.startsWith('call-')) move('called')
      if (id.startsWith('ans-')) {
        const answer = { ...s.current.answer, pending: s.current.answer.pending - 1 }
        s.current.answer = answer
        if (answer.done && answer.pending <= 0) resumeLesson()
      }
    },
    [move, resumeLesson],
  )

  const onIdle = useCallback(() => {
    const { queue, phase: now } = s.current
    if (!queue) return
    if (now === 'hand') callOn()
    else if (now === 'teaching' && !queue.isHeld) move('finished')
  }, [callOn, move])

  const stopAll = useCallback(() => {
    const queue = s.current.queue
    s.current.queue = null
    queue?.clear()
    void queue?.ctx.close().catch(() => undefined)
  }, [])

  // The mouth follows the voice: loudness read every frame, smoothed a little.
  useEffect(() => {
    let frame = 0
    let smooth = 0
    const tick = () => {
      const raw = s.current.queue?.level() ?? 0
      smooth = smooth * 0.55 + raw * 0.45
      level.set(smooth)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [level])

  useEffect(() => stopAll, [stopAll])

  const clearScreen = useCallback(() => {
    setLine(null)
    setSaid([])
    setBeat(-1)
    setAsker(null)
    s.current.beat = -1
    s.current.asker = null
  }, [])

  const write = useCallback(
    async (topic: string, grade: string | null, students: string[]) => {
      stopAll()
      clearScreen()
      setError(null)
      move('writing')
      s.current.topic = topic
      s.current.grade = grade
      try {
        const made = await writeLesson({ topic, grade_level: grade, students })
        s.current.lesson = made
        setLesson(made)
        move('ready')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The lesson could not be written.')
        move(s.current.lesson ? 'ready' : 'setup')
      }
    },
    [stopAll, clearScreen, move],
  )

  /** Start (or start again) from the first beat. Must run inside a tap: it unlocks sound. */
  const start = useCallback(async () => {
    const made = s.current.lesson
    if (!made) return
    stopAll()
    clearScreen()
    setError(null)
    const ctx = new AudioContext()
    await ctx.resume()
    s.current.queue = new SpeechQueue(ctx, {
      onStart,
      onEnd,
      onIdle,
      onError: () => setError('A part of the lesson could not be voiced. Carrying on.'),
    })
    move('teaching')
    const beats = made.beats.map((b) => clip(b.id, b.say, 'lesson', b.pause))
    const recap = made.recap ? [clip('recap', made.recap, 'lesson', 'breath')] : []
    s.current.queue.add(...beats, ...recap)
  }, [stopAll, clearScreen, onStart, onEnd, onIdle, move, clip])

  const pause = useCallback(async () => {
    await s.current.queue?.ctx.suspend()
    move('paused')
  }, [move])

  const resume = useCallback(async () => {
    await s.current.queue?.ctx.resume()
    move(s.current.asker ? 'hand' : 'teaching')
  }, [move])

  const raiseHand = useCallback(
    (name: string) => {
      const queue = s.current.queue
      if (!queue || s.current.phase !== 'teaching') return
      s.current.asker = name
      setAsker(name)
      move('hand')
      queue.hold()
      // While the tutor finishes its thought, warm the model for the question.
      void warmTutor({ topic: s.current.topic, grade_level: s.current.grade, taught: taught() }).catch(
        () => undefined,
      )
      if (!queue.isBusy) callOn()
    },
    [move, taught, callOn],
  )

  const ask = useCallback(
    async (question: string) => {
      const { queue, asker: name, lesson: made } = s.current
      const lines = name ? made?.lines[name] : undefined
      if (!queue || !name || !lines || s.current.phase !== 'called') return
      move('answering')
      const id = nextId('q')
      setSaid((all) => [...all, { id, speaker: 'student', name, text: question }])
      setLine({ key: id, text: question, start: queue.now(), duration: 1, speaker: 'student', name })
      s.current.answer = { pending: 1, done: false }
      queue.add(clip(nextId('ans'), lines.thanks, 'tutor', 'short'))
      try {
        const events = askTutor({
          question,
          student: name,
          topic: s.current.topic,
          grade_level: s.current.grade,
          taught: taught(),
        })
        for await (const event of events) {
          if (event.type === 'done') break
          s.current.answer = { ...s.current.answer, pending: s.current.answer.pending + 1 }
          queue.add(clip(nextId('ans'), event.text, 'tutor', 'join'))
        }
      } catch {
        setError('The tutor could not answer just now.')
      }
      s.current.answer = { ...s.current.answer, done: true }
      if (s.current.answer.pending <= 0) resumeLesson()
    },
    [move, clip, taught, resumeLesson],
  )

  const reset = useCallback(() => {
    stopAll()
    clearScreen()
    move(s.current.lesson ? 'ready' : 'setup')
  }, [stopAll, clearScreen, move])

  const now = useCallback(() => s.current.queue?.now() ?? 0, [])

  return { phase, lesson, error, line, beat, speaking, asker, said, level, now, write, start, pause, resume, raiseHand, ask, reset }
}
