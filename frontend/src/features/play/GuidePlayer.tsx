/**
 * A study guide, the whole of it on one page.
 *
 * The cover first — the big question, a map of the ideas, how to read it.
 * Then every part, one after another: a picture, the teaching at the
 * reader's level (read aloud if they like), what makes it stick, and one
 * check. Last, the big ideas, the words to know, and something to try.
 *
 * All of it is there to scroll, the way the teacher saw it, so nobody
 * wonders where the rest went. The checks are answered like quiz questions,
 * so progress is saved as it goes and the teacher sees it live. The bar at
 * the top follows the part in view.
 */
import { WarningCircle } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { pick } from '@/features/buddies'
import type { ReadingLevel } from '@/features/learning/api'
import { CheckCard } from '@/features/guide/CheckCard'
import { GuideCover } from '@/features/guide/GuideCover'
import { GuideEnd, glossaryOf } from '@/features/guide/GuideEnd'
import { GuideFinale, PartPractice } from '@/features/guide/GuideJourney'
import { guideBoss, partRounds } from '@/features/guide/journey'
import { RoundSheet, type SheetRound } from '@/features/guide/RoundSheet'
import { bandOf } from '@/features/game/rounds'
import { rememberLevel, rememberedLevel } from '@/features/guide/level'
import { SectionBody } from '@/features/guide/SectionBody'
import { translationLabel } from '@/features/guide/text'
import { useReadAloud } from '@/features/guide/useReadAloud'
import { useSound } from '@/lib/sound'
import { useCalmMotion } from '@/motion'
import type { Attempt, GuidePage, Played } from './api'
import { usePlayBackend } from './backend'
import { BuddySpot } from './BuddyDock'
import { PlayHeader } from './PlayChrome'
import type { PlayerProps } from './players'
import { playedById, resumeAt, segments, skillLabel } from './session'

const WONDER = ['Whoa, I did not know that!', 'That is SO cool!', 'Wait till you tell your friends!', 'Mind. Blown.']
const END_ID = 'guide-end'
// The years a Boss Battle is too much for, as in a game (`game_finish.NO_BOSS`).
const NO_BOSS = new Set(['year_1', 'year_2'])

interface Sheet {
  title: string
  rounds: SheetRound[]
  /** The part it practises; none for the boss. */
  part?: string
}

export function guidePages(attempt: Attempt): GuidePage[] {
  return attempt.items.filter((item): item is GuidePage => 'heading' in item)
}

export const partId = (i: number) => `part-${i + 1}`

export function GuidePlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const pages = useMemo(() => guidePages(attempt), [attempt])
  const [played, setPlayed] = useState<Record<string, Played>>(() => playedById(attempt.answered))
  const [level, setLevel] = useState<ReadingLevel>(rememberedLevel)
  const [sending, setSending] = useState<string | null>(null)
  const [justAnswered, setJustAnswered] = useState<string | null>(null)
  const seenAt = useRef<Record<string, number>>({})
  const openedAt = useRef(Date.now())
  const voice = useReadAloud(attempt.language)
  const { toast } = useToast()
  const sound = useSound()
  const calm = useCalmMotion()
  const backend = usePlayBackend()
  const label = translationLabel(attempt.language)
  const journey = useJourney(attempt, pages)
  const inView = usePartInView(pages.length, (i) => {
    const id = pages[i]?.id
    if (id && !seenAt.current[id]) seenAt.current[id] = Date.now()
  })

  // Hello from the buddy on the cover, once.
  useEffect(() => {
    const at = window.setTimeout(() => buddy.current?.say(`Ready to explore ${attempt.title}?`, 3200), 900)
    return () => window.clearTimeout(at)
  }, [attempt.title, buddy])

  function go(to: number | 'end') {
    const id = to === 'end' || to >= pages.length ? END_ID : partId(to)
    document.getElementById(id)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  }

  function changeLevel(to: ReadingLevel) {
    voice.stop()
    setLevel(to)
    rememberLevel(to)
    if (to === 'stretch') buddy.current?.cue('correct', { streak: 0 })
  }

  async function choose(page: GuidePage, choice: number) {
    if (played[page.id] || sending) return
    setSending(page.id)
    sound('tap')
    try {
      const since = seenAt.current[page.id] ?? openedAt.current
      const result = await backend.answer(attempt.id, { item_id: page.id, choice, time_ms: Date.now() - since })
      setPlayed((now) => ({ ...now, [page.id]: result.played }))
      setJustAnswered(page.id)
      if (result.played.correct) {
        sound('correct')
        buddy.current?.cue('correct', { streak: result.streak })
      } else {
        sound('wrong')
        buddy.current?.cue('wrong')
      }
    } catch (error) {
      toast('That answer did not send', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSending(null)
    }
  }

  const unanswered = pages.filter((p) => !played[p.id])

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayHeader title={attempt.title} kind="study_guide" parts={segments(pages, played, inView)} exitTo={exitTo} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-40 md:pt-10">
        <GuideCover
          title={attempt.title}
          extras={attempt.extras}
          sections={pages}
          level={level}
          onLevel={changeLevel}
          onStart={() => go(resumeAt(pages, played))}
          onJump={(i) => go(i)}
          resumeAt={resumeAt(pages, played)}
        />

        {pages.map((page, i) => (
          <section key={page.id} id={partId(i)} data-part={i} className="mt-16 scroll-mt-24 border-t-2 border-dashed border-border pt-10">
            <SectionBody
              section={page}
              number={i + 1}
              total={pages.length}
              skill={skillLabel(attempt, page.skill)}
              level={level}
              onLevel={changeLevel}
              voice={voice}
              translationLabel={label}
              onFact={() => {
                buddy.current?.play('think')
                buddy.current?.say(pick(WONDER), 2600)
              }}
            />
            <PartPractice rounds={journey.rounds[i]} played={journey.practised.has(page.id)} onPlay={() => journey.open({ title: page.heading, rounds: journey.rounds[i], part: page.id })} />
            <CheckCard
              prompt={page.prompt}
              options={page.options}
              busy={sending === page.id}
              result={resultOf(played[page.id])}
              onChoose={(n) => void choose(page, n)}
              onNext={() => go(i + 1)}
              nextLabel={i + 1 < pages.length ? `On to part ${i + 2}` : 'See the big ideas'}
              focusNext={justAnswered === page.id}
            />
          </section>
        ))}

        <section id={END_ID} className="mt-16 scroll-mt-24 border-t-2 border-dashed border-border pt-10">
          {unanswered.length > 0 && (
            <div className="mb-6 rounded-2xl border-2 border-warning/40 bg-warning/10 p-4">
              <p className="flex items-center gap-2 font-bold">
                <WarningCircle weight="fill" className="size-5 shrink-0 text-warning" aria-hidden />
                {unanswered.length === 1 ? 'One check is still waiting' : `${unanswered.length} checks are still waiting`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unanswered.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal py-1.5 text-left" onClick={() => go(pages.indexOf(p))}>
                    Part {pages.indexOf(p) + 1}: {p.heading}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <GuideEnd
            extras={attempt.extras}
            glossary={glossaryOf(pages)}
            translationLabel={label}
            onFinish={unanswered.length === 0 ? onFinished : undefined}
          >
            <GuideFinale
              stops={pages.map((p) => ({ heading: p.heading, done: Boolean(played[p.id]) }))}
              boss={journey.boss ? { beaten: journey.bossBeaten } : null}
              quiz={journey.canQuiz}
              onBoss={journey.openBoss}
              onQuiz={() => void journey.takeQuiz()}
              quizBusy={journey.quizBusy}
            />
          </GuideEnd>
        </section>
        <BuddySpot />
      </main>
      {journey.sheet && (
        <RoundSheet
          title={journey.sheet.title}
          rounds={journey.sheet.rounds}
          band={bandOf(attempt.grade_level)}
          onClose={journey.close}
          onDone={() => {
            journey.done()
            buddy.current?.cue('correct', { streak: 3 })
          }}
        />
      )}
    </div>
  )
}

/**
 * Learn → Practise → Play (§28.3.8): each part's rounds, which were played
 * (remembered on this device), the guide's boss, and its quiz.
 */
function useJourney(attempt: Attempt, pages: GuidePage[]) {
  const backend = usePlayBackend()
  const navigate = useNavigate()
  const { toast } = useToast()
  const key = `mentora:practised:${attempt.id}`
  const parts = useMemo(() => pages.map((p) => ({ id: p.id, terms: p.terms, steps: p.steps })), [pages])
  const rounds = useMemo(() => parts.map((_, i) => partRounds(parts, i, attempt.language)), [parts, attempt.language])
  const boss = useMemo(() => (NO_BOSS.has(attempt.grade_level ?? '') ? null : guideBoss(parts, attempt.language)), [parts, attempt.grade_level, attempt.language])
  const [practised, setPractised] = useState<Set<string>>(() => remembered(key))
  const [bossBeaten, setBossBeaten] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [quizBusy, setQuizBusy] = useState(false)
  const close = useCallback(() => setSheet(null), [])

  function done() {
    if (!sheet?.part) return setBossBeaten(true)
    const next = new Set(practised).add(sheet.part)
    setPractised(next)
    try {
      window.localStorage.setItem(key, JSON.stringify([...next]))
    } catch {
      // Not remembered on this device: the part offers its game again.
    }
  }

  async function takeQuiz() {
    if (!backend.guideQuiz) return
    setQuizBusy(true)
    try {
      const made = await backend.guideQuiz(attempt.id)
      navigate(`/practice/${made.set_id}`)
    } catch (error) {
      toast('The quiz could not open', { tone: 'error', body: errorMessage(error) })
      setQuizBusy(false)
    }
  }

  const openBoss = () => boss && setSheet({ title: `${attempt.title}: the boss`, rounds: [{ play: 'boss', content: boss }] })
  return { rounds, boss, practised, bossBeaten, sheet, quizBusy, canQuiz: Boolean(backend.guideQuiz), open: setSheet, close, done, openBoss, takeQuiz }
}

function remembered(key: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/**
 * Which part is in the middle of the screen, or -1 on the cover. `onSeen`
 * hears each part the first time it comes into view.
 */
function usePartInView(count: number, onSeen: (i: number) => void): number {
  const [at, setAt] = useState(-1)
  const seen = useRef(onSeen)
  useEffect(() => {
    seen.current = onSeen
  })
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = Number((entry.target as HTMLElement).dataset.part)
          setAt(i)
          seen.current(i)
        }
      },
      // A thin band across the middle of the screen: the part crossing it is
      // the one being read.
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (let i = 0; i < count; i++) {
      const el = document.getElementById(partId(i))
      if (el) watcher.observe(el)
    }
    const cover = () => window.scrollY < 80 && setAt(-1)
    window.addEventListener('scroll', cover, { passive: true })
    return () => {
      watcher.disconnect()
      window.removeEventListener('scroll', cover)
    }
  }, [count])
  return at
}

function resultOf(played: Played | undefined) {
  if (!played) return null
  return {
    choice: played.choice,
    correct: played.correct,
    answer: played.reveal?.answer,
    explanation: played.reveal?.explanation,
  }
}
