/**
 * A study guide, read part by part.
 *
 * The cover first — the big question, a map of the ideas, how to read it.
 * Then each part: a picture, the teaching at the reader's level (read aloud
 * if they like), what makes it stick, and one check. The checks are answered
 * like quiz questions, so progress is saved as it goes and the teacher sees
 * it live. Last, the big ideas, the words to know, and something to try.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { pick } from '@/features/buddies'
import type { ReadingLevel } from '@/features/learning/api'
import { CheckCard } from '@/features/guide/CheckCard'
import { GuideCover } from '@/features/guide/GuideCover'
import { GuideEnd, glossaryOf } from '@/features/guide/GuideEnd'
import { rememberLevel, rememberedLevel } from '@/features/guide/level'
import { SectionBody } from '@/features/guide/SectionBody'
import { translationLabel } from '@/features/guide/text'
import { useReadAloud } from '@/features/guide/useReadAloud'
import { useSound } from '@/lib/sound'
import { spring, useCalmMotion } from '@/motion'
import { playApi, type Attempt, type GuidePage, type Played } from './api'
import { PlayHeader } from './PlayChrome'
import type { PlayerProps } from './players'
import { playedById, resumeAt, segments, skillLabel } from './session'

type Place = 'cover' | 'end' | number

const WONDER = ['Whoa, I did not know that!', 'That is SO cool!', 'Wait till you tell your friends!', 'Mind. Blown.']

export function guidePages(attempt: Attempt): GuidePage[] {
  return attempt.items.filter((item): item is GuidePage => 'heading' in item)
}

export function GuidePlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const pages = useMemo(() => guidePages(attempt), [attempt])
  const [played, setPlayed] = useState<Record<string, Played>>(() => playedById(attempt.answered))
  const [place, setPlace] = useState<Place>('cover')
  const [level, setLevel] = useState<ReadingLevel>(rememberedLevel)
  const [sending, setSending] = useState(false)
  const shownAt = useRef(Date.now())
  const voice = useReadAloud(attempt.language)
  const { toast } = useToast()
  const sound = useSound()
  const calm = useCalmMotion()
  const label = translationLabel(attempt.language)
  const next = resumeAt(pages, played)
  const index = typeof place === 'number' ? place : place === 'end' ? pages.length : -1
  const page = typeof place === 'number' ? pages[place] : undefined

  useEffect(() => {
    shownAt.current = Date.now()
  }, [place])

  // Hello from the buddy on the cover, once.
  useEffect(() => {
    const at = window.setTimeout(() => buddy.current?.say(`Ready to explore ${attempt.title}?`, 3200), 900)
    return () => window.clearTimeout(at)
  }, [attempt.title, buddy])

  function go(to: Place) {
    voice.stop()
    setPlace(to)
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' })
  }

  function changeLevel(to: ReadingLevel) {
    voice.stop()
    setLevel(to)
    rememberLevel(to)
    if (to === 'stretch') buddy.current?.cue('correct', { streak: 0 })
  }

  async function choose(choice: number) {
    if (!page || played[page.id] || sending) return
    setSending(true)
    sound('tap')
    try {
      const result = await playApi.answer(attempt.id, { item_id: page.id, choice, time_ms: Date.now() - shownAt.current })
      setPlayed((now) => ({ ...now, [page.id]: result.played }))
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
      setSending(false)
    }
  }

  const unanswered = pages.filter((p) => !played[p.id])

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayHeader title={attempt.title} kind="study_guide" parts={segments(pages, played, index)} exitTo={exitTo} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-40 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={String(place)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.16 } }}
            transition={spring.gentle}
          >
            {place === 'cover' && (
              <GuideCover
                title={attempt.title}
                extras={attempt.extras}
                sections={pages}
                level={level}
                onLevel={changeLevel}
                onStart={() => go(next >= pages.length ? 'end' : next)}
                onJump={(i) => go(i)}
                resumeAt={next}
              />
            )}

            {page && typeof place === 'number' && (
              <>
                <SectionBody
                  section={page}
                  number={place + 1}
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
                <CheckCard
                  prompt={page.prompt}
                  options={page.options}
                  busy={sending}
                  result={resultOf(played[page.id])}
                  onChoose={(n) => void choose(n)}
                  onNext={() => go(place + 1 < pages.length ? place + 1 : 'end')}
                  nextLabel={place + 1 < pages.length ? `On to part ${place + 2}` : 'See the big ideas'}
                />
                <div className="mt-6">
                  <Button variant="ghost" onClick={() => go(place === 0 ? 'cover' : place - 1)}>
                    <ArrowLeft weight="bold" className="size-4" />
                    {place === 0 ? 'Back to the cover' : `Back to part ${place}`}
                  </Button>
                </div>
              </>
            )}

            {place === 'end' && (
              <>
                {unanswered.length > 0 && (
                  <div className="mb-6 rounded-2xl border-2 border-warning/40 bg-warning/10 p-4">
                    <p className="flex items-center gap-2 font-bold">
                      <WarningCircle weight="fill" className="size-5 text-warning" aria-hidden />
                      {unanswered.length === 1 ? 'One check is still waiting' : `${unanswered.length} checks are still waiting`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unanswered.map((p) => (
                        <Button key={p.id} variant="outline" size="sm" onClick={() => go(pages.indexOf(p))}>
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
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
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
