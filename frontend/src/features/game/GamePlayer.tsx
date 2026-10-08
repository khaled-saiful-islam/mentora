/**
 * Play and Learn (§23): a story game, full screen. The world is drawn behind,
 * the story is told in Astra's voice, the student's own buddy comes along as
 * the sidekick, and the challenges are played in the game's style — a map, a
 * road, bubbles or a build. Every answer is marked where answers go (the
 * server, or a teacher's preview); the points the game counts on the way are
 * the server's sums, and the finish screen shows the server's own.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { Buddy, profileOf } from '@/features/buddies'
import type { GameExtras } from '@/features/learning/api'
import type { Played } from '@/features/play/api'
import type { PlayerProps } from '@/features/play/players'
import { usePlayVoice, type Line } from '@/features/play/usePlayVoice'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { celebrate, useCalmMotion } from '@/motion'
import { seedOf } from './audio/music'
import { useGameAudio } from './audio/useGameAudio'
import { chapterStars, told } from './chapters'
import { chapterScore } from './run'
import { STYLE_PLAYERS } from './styles'
import { ChallengeCard } from './ui/ChallengeCard'
import { Hud } from './ui/Hud'
import { Reveal } from './ui/Reveal'
import { ChapterEndScene, ChapterScene, FinaleScene, TitleScene, type Telling } from './ui/scenes'
import { TimerRing } from './ui/TimerRing'
import { useCountdown } from './ui/useCountdown'
import { useGameRun, type GameRun } from './useGameRun'
import { Backdrop } from './worlds/Backdrop'
import { useFullscreen } from './useFullscreen'
import { isStyle, isWorld, STYLES, WORLDS } from './worlds/info'

/** A buddy that is not there to talk. */
const QUIET: PlayerProps['buddy'] = { current: null }

export function GamePlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const calm = useCalmMotion()
  const onError = useCallback((error: unknown) => toast('That did not go through', { tone: 'error', body: errorMessage(error) }), [toast])
  const run = useGameRun(attempt, onError)
  const { state, chapters, current, outcome, extras } = run
  const { phase } = state
  const style = isStyle(extras.style) ? extras.style : 'quest'
  const world = isWorld(extras.world) ? extras.world : 'rainforest'
  const buddyName = profileOf(user?.buddy).name
  const audio = useGameAudio(world, style, seedOf(`${attempt.set_id}${attempt.title}`))
  const voice = usePlayVoice(attempt.id, attempt.language)
  const stage = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(stage)
  const expire = useRef<(() => void) | null>(null)
  const setExpire = useCallback((fn: (() => void) | null) => {
    expire.current = fn
  }, [])
  const started = useRef(false)

  const chapterIndex = phase.name === 'chapter' || phase.name === 'chapterEnd' ? phase.chapter : current ? chapterOf(run, current.id) : null
  const chapter = chapterIndex !== null ? chapters[chapterIndex] : null
  const boss = phase.name === 'challenge' || phase.name === 'reveal' ? run.isBoss(phase.index) : false
  const seconds = attempt.timer_seconds ?? null
  const left = useCountdown(seconds, phase.name === 'challenge' && !run.sending, current?.id ?? '', () => (expire.current ?? (() => void run.timeUp()))(), (s) => s <= 5 && s > 0 && audio.effect('tick'))

  // Unless the screen has a margin for it, the buddy in the corner steps aside
  // while the challenge is played — it would sit on the answers — and keeps
  // its words to itself until it is back.
  const roomy = useMediaQuery('(min-width: 1280px)')
  const speaking = roomy || !current
  useReactions(run, audio.effect, speaking ? buddy : QUIET, calm)
  useEffect(() => {
    audio.setBoss(boss && phase.name === 'challenge')
  }, [boss, phase.name, audio])
  useEffect(() => {
    if (boss && phase.name === 'challenge') audio.effect('boss')
  }, [boss, phase.name, audio])

  // The story is told as each part of it arrives — once there has been a tap.
  const scene = sceneLines(phase, extras, chapterIndex, buddyName)
  const sceneKey = scene ? scene.key : null
  useEffect(() => {
    if (sceneKey && scene && started.current && audio.on) voice.read(sceneKey, scene.lines)
    // Read once per scene; `scene` is rebuilt every render.
  }, [sceneKey])

  const telling = (key: string | null, lines: Line[]): Telling => ({
    reading: key !== null && voice.reading === key,
    readable: voice.supported && lines.length > 0,
    toggle: () => (key && voice.reading === key ? voice.stop() : key && voice.read(key, lines)),
  })
  const sceneTelling = telling(sceneKey, scene?.lines ?? [])
  const title = extras.title || attempt.title

  return (
    <div ref={stage} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background" data-game-style={style} data-game-world={world}>
      <Backdrop world={world} motion={style === 'runner' && phase.name === 'challenge' ? 'run' : 'drift'} calm={calm} className="fixed" />
      <Hud
        title={title}
        exitTo={exitTo}
        chapterStars={chapters.map((c, i) => (chapterDone(run, i) ? chapterStars(chapterScore(run.layout, state, i).correct, c.items.length) : null))}
        chapter={chapterIndex}
        points={state.points}
        streak={state.streak}
        soundOn={audio.on}
        onSound={audio.toggle}
        fullscreen={fullscreen.on}
        onFullscreen={fullscreen.available ? fullscreen.toggle : null}
      />
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-3 pb-28 pt-2">
        <AnimatePresence mode="wait">
          <motion.div key={phase.name === 'reveal' ? `challenge-${phase.index}` : `${phase.name}-${'index' in phase ? phase.index : 'chapter' in phase ? phase.chapter : ''}`} className="flex w-full flex-1 flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {phase.name === 'title' && (
              <TitleScene
                title={title}
                subtitle={`${STYLES[style].label} · ${WORLDS[world].label}`}
                hook={told(extras.story?.hook, buddyName)}
                goal={told(extras.story?.goal, buddyName)}
                resuming={attempt.answered.length > 0}
                telling={sceneTelling}
                onStart={() => {
                  started.current = true
                  audio.start()
                  audio.effect('start')
                  if (scene && audio.on && attempt.answered.length === 0) voice.read(scene.key, scene.lines)
                }}
                onBegin={() => run.dispatch({ type: 'begin' })}
              />
            )}
            {phase.name === 'chapter' && chapter && (
              <ChapterScene number={phase.chapter + 1} total={chapters.length} title={chapter.title} intro={told(chapter.intro, buddyName)} telling={sceneTelling} onGo={() => run.dispatch({ type: 'go' })} />
            )}
            {(phase.name === 'challenge' || phase.name === 'reveal') && current && chapter && (
              <Challenge run={run} style={style} world={world} chapter={chapter} boss={boss} left={left} seconds={seconds} calm={calm} buddyKey={user?.buddy} buddyName={buddyName} voice={voice} telling={telling} effect={audio.effect} onExpire={setExpire} buddy={speaking ? buddy : QUIET} />
            )}
            {phase.name === 'chapterEnd' && chapter && (
              <ChapterEndScene
                number={phase.chapter + 1}
                title={chapter.title}
                outro={told(chapter.outro, buddyName)}
                {...chapterScore(run.layout, state, phase.chapter)}
                stars={chapterStars(chapterScore(run.layout, state, phase.chapter).correct, chapter.items.length)}
                last={phase.chapter === chapters.length - 1}
                calm={calm}
                telling={sceneTelling}
                onStar={() => audio.effect('chapter')}
                onNext={() => run.dispatch({ type: 'onward' })}
              />
            )}
            {phase.name === 'finale' && (
              <Finale title={title} win={told(extras.story?.win, buddyName)} calm={calm} telling={sceneTelling} effect={audio.effect} onFinished={onFinished} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <div className={cn('pointer-events-none fixed bottom-2 left-2 z-30 [&_button]:pointer-events-auto', current && 'max-xl:hidden')}>
        <Buddy ref={buddy} buddy={user?.buddy} size={96} bubble="right" speaks />
      </div>
      <p className="sr-only" aria-live="polite">
        {outcome ? (outcome.correct ? 'Right!' : 'Not quite.') : ''}
      </p>
    </div>
  )
}

/** The challenge being played: its card, its style, and once answered, why. */
function Challenge(props: {
  run: GameRun
  style: keyof typeof STYLE_PLAYERS
  world: NonNullable<GameExtras['world']>
  chapter: GameRun['chapters'][number]
  boss: boolean
  left: number
  seconds: number | null
  calm: boolean
  buddyKey: string | null | undefined
  buddyName: string
  voice: ReturnType<typeof usePlayVoice>
  telling: (key: string | null, lines: Line[]) => Telling
  effect: ReturnType<typeof useGameAudio>['effect']
  onExpire: (fn: (() => void) | null) => void
  buddy: PlayerProps['buddy']
}) {
  const { run, style, world, chapter, boss, left, seconds, calm, buddyKey, buddyName, telling, effect, onExpire, buddy } = props
  const { current, outcome, state } = run
  if (!current) return null
  const index = run.items.indexOf(current)
  const Style = STYLE_PLAYERS[style]
  const question: Line[] = [
    { spoken: { item: current.id, part: 'question' }, text: current.prompt },
    ...current.options.map((text, n) => ({ spoken: { item: current.id, part: 'option' as const, n }, text })),
  ]
  const ask = telling(`q-${current.id}`, question)
  const why: Line[] = outcome?.reveal?.explanation ? [{ spoken: { item: current.id, part: 'explanation' }, text: outcome.reveal.explanation }] : []
  const reading = telling(`why-${current.id}`, why)
  const number = index - chapter.start + 1
  const lastInChapter = number === chapter.items.length
  const askHint = async () => {
    const hint = await run.askHint()
    if (hint) {
      effect('hint')
      buddy.current?.say(hint, 6000)
    }
  }
  const card = (
    <ChallengeCard
      prompt={current.prompt}
      label={boss ? 'The boss challenge!' : `Challenge ${number} of ${chapter.items.length}`}
      boss={boss}
      hint={run.hint}
      canHint={current.has_hint && !outcome && !run.hint}
      buddyName={buddyName}
      onHint={() => void askHint()}
      reading={ask.reading}
      readable={ask.readable}
      onRead={ask.toggle}
      timer={seconds && !outcome ? <TimerRing left={left} seconds={seconds} /> : undefined}
    />
  )
  return (
    // Room under the challenge for the answer's panel, pinned at the bottom.
    <div className={cn('flex w-full flex-1 flex-col', outcome && 'pb-72')}>
      <Style
        world={world}
        item={current}
        index={index}
        items={run.items}
        chapterStart={chapter.start}
        chapterItems={chapter.items}
        played={state.played}
        boss={boss}
        outcome={outcome}
        locked={Boolean(outcome) || run.sending}
        left={left}
        timed={Boolean(seconds)}
        calm={calm}
        buddy={buddyKey}
        card={card}
        onChoose={(n) => void run.choose(n)}
        onExpire={onExpire}
        effect={effect}
      />
      {outcome && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl p-3">
          <Reveal
            correct={outcome.correct === true}
            right={typeof outcome.reveal?.answer === 'number' ? current.options[outcome.reveal.answer] ?? null : null}
            explanation={outcome.reveal?.explanation ?? ''}
            timedOut={outcome.choice === null}
            earned={run.lastEarned}
            reading={reading.reading}
            readable={reading.readable}
            onRead={reading.toggle}
            onNext={() => run.dispatch({ type: 'next' })}
            nextLabel={lastInChapter ? 'Finish the chapter' : 'Next challenge'}
          />
        </div>
      )}
    </div>
  )
}

function Finale(props: {
  title: string
  win: string
  calm: boolean
  telling: Telling
  effect: ReturnType<typeof useGameAudio>['effect']
  onFinished: () => void
}) {
  const { title, win, calm, telling, effect, onFinished } = props
  useEffect(() => {
    effect('victory')
    celebrate({ calm, power: 1.2, origin: { x: 0.5, y: 0.45 } })
  }, [effect, calm])
  return <FinaleScene title={title} win={win || 'You did it — the adventure is complete!'} telling={telling} onFinish={onFinished} />
}

/** Sounds, the buddy and confetti for each answer as it comes back. */
function useReactions(run: GameRun, effect: ReturnType<typeof useGameAudio>['effect'], buddy: PlayerProps['buddy'], calm: boolean) {
  const { outcome, state } = run
  const seen = useRef<Played | null>(null)
  useEffect(() => {
    if (!outcome || seen.current === outcome) return
    seen.current = outcome
    if (outcome.correct) {
      const streak = state.streak
      effect(streak >= 3 ? 'combo' : 'right', streak)
      buddy.current?.cue('correct', { streak })
      if (streak >= 3 && streak % 3 === 0) celebrate({ calm, power: 0.6, origin: { x: 0.5, y: 0.6 } })
    } else {
      effect('wrong')
      buddy.current?.cue('wrong')
    }
  }, [outcome, state.streak, effect, buddy, calm])
}

/** What the current scene says aloud, and the words for the browser's voice. */
function sceneLines(phase: GameRun['state']['phase'], extras: Partial<GameExtras>, chapter: number | null, buddyName: string): { key: string; lines: Line[] } | null {
  const story = extras.story
  const line = (item: 'hook' | 'goal' | 'intro' | 'outro' | 'win', text: string | undefined, n?: number): Line[] =>
    text ? [{ spoken: { item, part: 'story', n }, text: told(text, buddyName) }] : []
  if (phase.name === 'title') return { key: 'hook', lines: [...line('hook', story?.hook), ...line('goal', story?.goal)] }
  if (phase.name === 'chapter' && chapter !== null) return { key: `intro-${chapter}`, lines: line('intro', story?.chapters?.[chapter]?.intro, chapter) }
  if (phase.name === 'chapterEnd' && chapter !== null) return { key: `outro-${chapter}`, lines: line('outro', story?.chapters?.[chapter]?.outro, chapter) }
  if (phase.name === 'finale') return { key: 'win', lines: line('win', story?.win) }
  return null
}

function chapterOf(run: GameRun, itemId: string): number | null {
  const index = run.layout.ids.indexOf(itemId)
  const found = run.chapters.findIndex((c) => index >= c.start && index < c.start + c.items.length)
  return found < 0 ? null : found
}

function chapterDone(run: GameRun, chapter: number): boolean {
  const { start, items } = run.chapters[chapter]
  return run.layout.ids.slice(start, start + items.length).every((id) => run.state.played[id])
}
