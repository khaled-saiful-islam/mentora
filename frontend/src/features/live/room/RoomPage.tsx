/**
 * The live lesson room — for the group's students, and for their teacher.
 *
 * Before the room opens: when it is, and a countdown. From ten
 * minutes before: the lobby, a night sky where each classmate who comes in
 * floats up as their buddy. Then Astra teaches: the key idea on screen, the
 * words lighting up as they are said, hands going up, quick checks, and at
 * the end a celebration and the quiz.
 */
import { ArrowLeft, Clock, FastForward, Flag, Pause, Play, Stop } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import type { Mood } from '@/features/buddies/types'
import { starField } from '@/features/auth/scene/sky'
import { Page, spring } from '@/motion'
import { LiveStage } from '../LiveStage'
import { AstraBadge } from '../sessions/SessionCard'
import { countdown, joinOpen, whenLabel } from '../sessions/when'
import { useNow } from '../schedule/SchedulePage'
import { roomApi } from './api'
import { Notes } from './Notes'
import { CheckinCard, Classmates, Ending, HandControl, SoundGate } from './RoomParts'
import { TeacherPanel } from './TeacherPanel'
import { useRoom } from './useRoom'

const STARS = starField(40, 23, 96)

export default function RoomPage({ teacherView = false }: { teacherView?: boolean }) {
  const { id = '' } = useParams()
  const room = useRoom(id)
  const now = useNow(1000)
  const session = room.joined?.session
  const student = room.joined?.role === 'student'
  const back = teacherView ? `/live/${id}` : '/schedule'

  if (!room.joined) {
    return (
      <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        {room.error ? <Alert>{room.error}</Alert> : <Skeleton className="h-96 rounded-[2rem]" />}
      </Page>
    )
  }

  const status = session?.status ?? 'scheduled'
  // The room's own news wins over what the page was first told: a lesson the
  // teacher begins early is live whatever its scheduled time says.
  const running = !['lobby', 'ended'].includes(room.phase)
  const waiting = !running && status === 'scheduled' && !joinOpen(session?.scheduled_at ?? null, status, now)
  const ended = room.phase === 'ended' || status === 'ended'
  const started = !waiting && !ended && room.phase !== 'lobby'

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <Link to={back} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft weight="bold" className="size-4" aria-hidden />
        {teacherView ? 'Back to the lesson' : 'My schedule'}
      </Link>
      {room.error && <Alert className="mb-4">{room.error}</Alert>}

      {room.removed ? (
        <Sky>
          <Title session={session} />
          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-white/10 p-4 font-semibold">Your teacher has taken you out of this lesson.</p>
        </Sky>
      ) : status === 'cancelled' ? (
        <Sky>
          <Title session={session} />
          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-white/10 p-4 font-semibold">This lesson was cancelled.</p>
        </Sky>
      ) : waiting ? (
        <Sky>
          <Title session={session} />
          {session?.scheduled_at && (
            <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
              <p className="inline-flex items-center gap-2 font-semibold">
                <Clock weight="bold" className="size-5" aria-hidden />
                {whenLabel(session.scheduled_at, now)}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">Starts {countdown(session.scheduled_at, now)}</p>
              <p className="mt-2 text-sm text-white/75">
                {student ? "The room opens ten minutes before. You'll get a reminder." : 'The room opens ten minutes before, and the group is reminded.'}
              </p>
              {!student && (
                <Button variant="sun" className="mt-4" onClick={() => void roomApi.begin(id)}>
                  <Play weight="fill" className="size-4" aria-hidden />
                  Begin the lesson now
                </Button>
              )}
            </div>
          )}
        </Sky>
      ) : !started && !ended ? (
        <Sky>
          <Title session={session} />
          <p className="mt-4 font-display text-2xl font-semibold">
            {session?.scheduled_at && new Date(session.scheduled_at).getTime() > now.getTime()
              ? `Astra starts ${countdown(session.scheduled_at, now)}`
              : 'Astra is about to start…'}
          </p>
          <p className="mt-1 text-white/75">You're in the room. Your classmates appear as they arrive.</p>
          <Classmates roster={room.roster} me={room.joined.me.id} className="mt-6" />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!room.soundOn && <SoundGate onEnable={() => void room.enableSound()} />}
            {room.soundOn && <p className="rounded-full bg-mint-400/20 px-4 py-2 font-bold text-mint-100">Sound is on — you're all set</p>}
            {!student && (
              <Button variant="sun" onClick={() => void roomApi.begin(id)}>
                <Play weight="fill" className="size-4" aria-hidden />
                Begin the lesson now
              </Button>
            )}
          </div>
        </Sky>
      ) : (
        <div className="space-y-4">
          <LiveStage
            beats={session?.segments_total ?? session?.parts ?? 0}
            beat={ended ? (session?.segments_total ?? session?.parts ?? 0) : room.segment}
            quiet={ended}
            show={room.show}
            image={ended ? null : room.image}
            line={room.line}
            now={room.serverNow}
            speaking={room.speaking}
            level={room.level}
            mood={moodFor(room.phase, room.speaking, ended)}
            hand={room.called?.name ?? null}
            status={ended ? null : room.phase === 'paused' ? 'Astra is taking a short pause.' : null}
          >
            <div className="space-y-4">
              {!room.soundOn && !ended && <SoundGate onEnable={() => void room.enableSound()} />}
              <CheckinCard
                checkin={room.checkin}
                result={room.result}
                choice={room.choice}
                answered={room.answered}
                serverNow={room.serverNow}
                onChoose={(i) => void room.choose(i)}
                canAnswer={student}
              />
              {ended ? (
                <Ending quiz={room.quiz} student={student} />
              ) : student ? (
                <HandControl
                  mine={room.mine}
                  left={room.left}
                  position={room.hands.findIndex((h) => h.student_id === room.joined?.me.id) + 1}
                  mode={room.joined?.questions.mode ?? 'anytime'}
                  calledName={room.called && room.called.student_id !== room.joined?.me.id ? room.called.name : null}
                  myQuestion={room.myQuestion}
                  onSend={(q) => void room.raiseHand(q)}
                  onLower={() => void room.lowerHand()}
                  onAsk={(text) => void room.ask(text)}
                />
              ) : (
                <TeacherControls id={id} paused={room.phase === 'paused'} hands={room.hands.map((h) => h.name)} />
              )}
              <Classmates roster={room.roster} me={room.joined?.me.id} />
            </div>
          </LiveStage>
          {!student && <TeacherPanel id={id} roster={room.roster} hands={room.hands} said={room.said} />}
          {student && <ReportButton id={id} />}
          {student && ended && <Notes id={id} />}
          {student && !ended && <Transcript said={room.said} />}
        </div>
      )}
    </Page>
  )
}

function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Flag weight="bold" className="size-4" aria-hidden />
          {sent ? 'Reported — thank you' : 'Report a problem'}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Tell us what's wrong"
        description="Something upsetting, or something that didn't seem right? Your teacher and the Mentora team will see it."
        footer={
          <Button
            disabled={text.trim().length < 3}
            onClick={() =>
              void roomApi.report(id, text.trim()).then(() => {
                setSent(true)
                setOpen(false)
                setText('')
              })
            }
          >
            Send
          </Button>
        }
      >
        <label htmlFor="room-report" className="sr-only">
          What happened?
        </label>
        <textarea
          id="room-report"
          rows={4}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened?"
          className="w-full rounded-2xl border-2 border-border bg-surface px-3 py-2"
        />
      </Dialog>
    </>
  )
}

function TeacherControls({ id, paused, hands }: { id: string; paused: boolean; hands: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {paused ? (
        <Button variant="sun" size="sm" onClick={() => void roomApi.control(id, 'resume')}>
          <Play weight="fill" className="size-4" aria-hidden />
          Carry on
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => void roomApi.control(id, 'pause')}>
          <Pause weight="fill" className="size-4" aria-hidden />
          Pause
        </Button>
      )}
      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => void roomApi.control(id, 'skip')}>
        <FastForward weight="fill" className="size-4" aria-hidden />
        Skip this part
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-white hover:bg-white/10"
        onClick={() => {
          if (window.confirm('End the lesson now?')) void roomApi.control(id, 'end')
        }}
      >
        <Stop weight="fill" className="size-4" aria-hidden />
        End the lesson
      </Button>
      {hands.length > 0 && <span className="text-sm font-semibold text-white/80">Hands up: {hands.join(', ')}</span>}
    </div>
  )
}

function Sky({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-b from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] p-6 text-center text-white shadow-xl sm:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {STARS.map((s, i) => (
          <span key={i} className="absolute rounded-full bg-white/70" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }} />
        ))}
      </div>
      {children}
    </section>
  )
}

function Title({ session }: { session?: { title: string; class_name: string; group_name: string; teacher_name: string | null } }) {
  if (!session) return null
  return (
    <>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="mx-auto w-fit">
        <AstraBadge size={170} mood="happy" />
      </motion.div>
      <p className="mt-2 text-sm font-bold uppercase tracking-wider text-sun-300">Live lesson with Astra</p>
      <h1 className="mx-auto mt-1 max-w-2xl break-words font-display text-3xl font-semibold leading-tight sm:text-5xl">{session.title}</h1>
      <p className="mt-2 text-white/80">
        {session.class_name} · {session.group_name}
        {session.teacher_name && ` · from ${session.teacher_name}`}
      </p>
    </>
  )
}

function Transcript({ said }: { said: { id: string; speaker: 'tutor' | 'student'; name?: string | null; text: string }[] }) {
  if (said.length === 0) return null
  return (
    <details className="rounded-3xl border-2 border-border bg-surface p-4">
      <summary className="cursor-pointer font-display text-lg font-semibold">What was said</summary>
      <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {said.map((s) => (
          <li key={s.id} className={s.speaker === 'student' ? 'break-words rounded-2xl bg-sun-100 px-3 py-2 text-sm text-grape-900' : 'break-words rounded-2xl bg-muted px-3 py-2 text-sm'}>
            <span className="font-bold">{s.speaker === 'student' ? s.name ?? 'A student' : 'Astra'}: </span>
            {s.text}
          </li>
        ))}
      </ol>
    </details>
  )
}

function moodFor(phase: string, speaking: boolean, ended: boolean): Mood {
  if (ended) return 'celebrate'
  if (phase === 'called') return speaking ? 'wave' : 'listen'
  if (phase === 'answering') return speaking ? 'happy' : 'think'
  if (phase === 'checkin') return 'think'
  if (phase === 'paused') return 'sleepy'
  return 'idle'
}
