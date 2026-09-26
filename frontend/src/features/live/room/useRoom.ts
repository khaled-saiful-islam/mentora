/**
 * A live lesson, from inside the room: join, keep the server's clock, follow
 * the room's events (reconnecting from the last one seen), play each clip at
 * its time, and show what is happening — the words, the key idea, the hands,
 * the quick check, the end.
 *
 * Captions run on the server's clock too, so they are right with the sound
 * on or off, and a student who has not tapped for sound still reads along.
 */
import { useMotionValue } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuidePicture } from '@/features/learning/api'
import type { Spoken } from '../Captions'
import { offsetFrom, type Sample } from './clock'
import { roomApi, roomEvents, type ClipEvent, type Joined, type RoomEvent, type RoomPhase, type RosterEntry, type RoomState } from './api'
import { RoomPlayer } from './RoomPlayer'

const RESULT_SHOWN_MS = 12_000

export type MyHand = 'none' | 'up' | 'called' | 'asked'

export interface Said {
  id: string
  speaker: 'tutor' | 'student'
  name?: string | null
  text: string
}

type Checkin = Extract<RoomEvent, { type: 'checkin' }>
type Result = Extract<RoomEvent, { type: 'checkin_result' }>

export function useRoom(id: string) {
  const [joined, setJoined] = useState<Joined | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<RoomPhase>('lobby')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [line, setLine] = useState<Spoken | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [show, setShow] = useState<string | null>(null)
  const [image, setImage] = useState<GuidePicture | null>(null)
  const [progress, setProgress] = useState<{ step: number; steps: number }>({ step: 0, steps: 0 })
  const [segment, setSegment] = useState(-1)
  const [hands, setHands] = useState<{ student_id: string; name: string }[]>([])
  const [called, setCalled] = useState<{ student_id: string; name: string } | null>(null)
  const [mine, setMine] = useState<MyHand>('none')
  const [left, setLeft] = useState(0)
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [answered, setAnswered] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [quiz, setQuiz] = useState<{ assignment_id: string; title: string } | null>(null)
  const [said, setSaid] = useState<Said[]>([])
  const [soundOn, setSoundOn] = useState(false)
  const [removed, setRemoved] = useState(false)
  const level = useMotionValue(0)

  const offset = useRef(0)
  const player = useRef<RoomPlayer | null>(null)
  const me = useRef<string | null>(null)
  const timers = useRef<number[]>([])
  const serverNow = useCallback(() => Date.now() / 1000 + offset.current, [])

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, Math.max(0, ms)))
  }

  const onClip = useCallback(
    (clip: ClipEvent, fresh = true) => {
      void player.current?.play(clip.key, clip.start, clip.duration)
      const wait = (clip.start - serverNow()) * 1000
      if (wait < -clip.duration * 1000) return
      later(wait, () => {
        setSpeaking(true)
        setLine({ key: `${clip.seq}`, text: clip.text, start: clip.start, duration: clip.duration, speaker: 'tutor' })
        // A clip replayed from a snapshot is already in the transcript we joined with.
        if (fresh) setSaid((all) => [...all.slice(-200), { id: `${clip.seq}`, speaker: 'tutor', text: clip.text }])
        if (clip.lane === 'lesson') {
          if (clip.show !== undefined) setShow(clip.show ?? null)
          if (clip.image !== undefined) setImage(clip.image ?? null)
          if (clip.steps) setProgress({ step: (clip.step ?? 0) + 1, steps: clip.steps })
          if (clip.segment !== undefined) setSegment(clip.segment)
        }
      })
      later(wait + clip.duration * 1000, () => setSpeaking(false))
    },
    [serverNow],
  )

  const apply = useCallback(
    (event: RoomEvent) => {
      switch (event.type) {
        case 'snapshot':
          restore(event.state)
          setRoster(event.roster)
          break
        case 'clip':
          onClip(event)
          break
        case 'prefetch':
          player.current?.prefetch(event.key)
          break
        case 'phase':
          setPhase(event.phase)
          break
        case 'roster':
          setRoster(event.roster)
          break
        case 'hands':
          setHands(event.queue)
          if (me.current && !event.queue.some((h) => h.student_id === me.current)) {
            setMine((m) => (m === 'up' ? 'called' : m))
          }
          break
        case 'called':
          if (event.student_id) {
            setCalled({ student_id: event.student_id, name: event.name ?? '' })
            if (event.student_id === me.current) setMine('called')
          } else {
            setCalled(null)
            setMine('none')
          }
          break
        case 'question':
          setSaid((all) => [...all, { id: `q${event.seq}`, speaker: 'student', name: event.name, text: event.text }])
          break
        case 'checkin':
          setCheckin(event)
          setResult(null)
          setChoice(null)
          setAnswered(0)
          break
        case 'checkin_count':
          setAnswered(event.answered)
          break
        case 'checkin_result':
          setResult(event)
          setCheckin(null)
          // Long enough to see how the group did and hear why; then the lesson has the stage.
          later(RESULT_SHOWN_MS, () => setResult((r) => (r?.seq === event.seq ? null : r)))
          break
        case 'ended':
          setPhase('ended')
          break
        case 'quiz':
          setQuiz({ assignment_id: event.assignment_id, title: event.title })
          break
        case 'error':
          setError(event.message)
          break
        case 'removed':
          if (event.student_id === me.current) {
            setRemoved(true)
            player.current?.close()
            player.current = null
          }
          break
      }
    },
    [onClip],
  )

  function restore(state: RoomState) {
    if (state.phase) setPhase(state.phase)
    if (state.show !== undefined) setShow(state.show ?? null)
    if (state.image !== undefined) setImage(state.image ?? null)
    if (state.hands) setHands(state.hands.queue)
    if (state.called?.student_id) setCalled({ student_id: state.called.student_id, name: state.called.name ?? '' })
    if (state.checkin) setCheckin(state.checkin)
    if (state.quiz) setQuiz({ assignment_id: state.quiz.assignment_id, title: state.quiz.title })
    if (state.clip) onClip(state.clip, false)
  }

  // Join, sync the clock, then follow the room — reconnecting from the last event seen.
  useEffect(() => {
    const stop = new AbortController()
    let seq: number | null = null
    void (async () => {
      try {
        const room = await roomApi.join(id)
        me.current = room.role === 'student' ? room.me.id : null
        setJoined(room)
        setLeft(room.questions.left)
        if (room.quiz) setQuiz(room.quiz)
        setSaid(room.transcript.map((t, i) => ({ id: `t${i}`, speaker: t.speaker === 'student' ? 'student' : 'tutor', name: t.name, text: t.text })))
        offset.current = offsetFrom(await sample())
        apply(room.snapshot)
        seq = room.snapshot.seq
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The room could not be opened.')
        return
      }
      while (!stop.signal.aborted) {
        try {
          for await (const event of roomEvents(id, seq, stop.signal)) {
            seq = event.seq ?? seq
            apply(event)
          }
        } catch {
          if (stop.signal.aborted) return
        }
        await new Promise((r) => window.setTimeout(r, 1500))
      }
    })()
    return () => {
      stop.abort()
      timers.current.forEach((t) => window.clearTimeout(t))
      player.current?.close()
      player.current = null
    }
  }, [id, apply])

  // Astra's mouth follows the voice.
  useEffect(() => {
    let frame = 0
    let smooth = 0
    const tick = () => {
      smooth = smooth * 0.55 + (player.current?.level() ?? 0) * 0.45
      level.set(smooth)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [level])

  /** Must run in a tap: browsers only let sound start from one. */
  const enableSound = useCallback(async () => {
    if (player.current) return
    const made = new RoomPlayer((key) => roomApi.clipUrl(id, key), serverNow)
    await made.unlock()
    player.current = made
    setSoundOn(true)
  }, [id, serverNow])

  const raiseHand = useCallback(async () => {
    try {
      const made = await roomApi.hand(id)
      setLeft(made.left)
      setMine('up')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your hand could not go up.')
    }
  }, [id])

  const lowerHand = useCallback(async () => {
    await roomApi.lower(id).catch(() => undefined)
    setMine('none')
  }, [id])

  const ask = useCallback(
    async (text: string) => {
      try {
        await roomApi.ask(id, text)
        setMine('asked')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Your question could not be sent.')
      }
    },
    [id],
  )

  const askAloud = useCallback(
    async (wav: Blob) => {
      try {
        await roomApi.askAloud(id, wav)
        setMine('asked')
      } catch (e) {
        setError(e instanceof Error ? e.message : "Astra didn't catch that. Try again, or type it.")
      }
    },
    [id],
  )

  const choose = useCallback(
    async (option: number) => {
      if (!checkin || choice !== null) return
      setChoice(option)
      await roomApi.checkin(id, checkin.segment_id, option).catch(() => undefined)
    },
    [id, checkin, choice],
  )

  return {
    joined, error, phase, roster, line, speaking, show, image, progress, segment, hands, called, mine, left,
    checkin, answered, choice, result, quiz, said, soundOn, removed, level, serverNow,
    enableSound, raiseHand, lowerHand, ask, askAloud, choose,
  }
}

async function sample(): Promise<Sample[]> {
  const samples: Sample[] = []
  for (let i = 0; i < 3; i++) {
    const sent = Date.now()
    try {
      const { now } = await roomApi.time()
      samples.push({ sent, received: Date.now(), server: now })
    } catch {
      // One missed sample is fine; none means no correction.
    }
  }
  return samples
}
