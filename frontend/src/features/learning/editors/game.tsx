/**
 * Editing a game (§23): each challenge — its question, two to four short
 * options, the right one, the buddy's hint and why — and the game's story and
 * world. Switching the style or the world changes how the same game is
 * played, with nothing rebuilt: save, and "Play it" shows it.
 */
import { motion } from 'motion/react'
import { CheckCircle, Info, Plus, Trash } from '@phosphor-icons/react'
import { Segmented } from '@/components/ui/Segmented'
import { Backdrop } from '@/features/game/worlds/Backdrop'
import { STYLE_KEYS, STYLES, WORLD_KEYS, WORLDS, isStyle, isWorld } from '@/features/game/worlds/info'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import type { GameChapter, GameExtras, GameItem } from '../api'
import { GrowingText, LabelledText, SkillPicker, SourceToggles } from './fields'
import type { ExtrasEditor, ItemEditorProps, KindEditor } from './types'

// The server's limits (`LIMITS` in app/learning/game.py), so nothing saved here
// is cut there.
export const LIMITS = {
  prompt: 220,
  option: 60,
  explanation: 300,
  hint: 160,
  title: 80,
  hook: 600,
  goal: 200,
  chapterTitle: 60,
  intro: 320,
  outro: 240,
  win: 320,
  retry: 200,
}
const MIN_OPTIONS = 2
const MAX_OPTIONS = 4

function ChallengeEditor({ item, skills, sources, onChange }: ItemEditorProps<GameItem>) {
  const set = (patch: Partial<GameItem>) => onChange({ ...item, ...patch })
  const remove = (index: number) => {
    const options = item.options.filter((_, i) => i !== index)
    const answer = item.answer === index ? 0 : item.answer > index ? item.answer - 1 : item.answer
    set({ options, answer })
  }
  return (
    <div className="space-y-3">
      <GrowingText label="Challenge" value={item.prompt} maxLength={LIMITS.prompt} placeholder="What the player is asked" onChange={(prompt) => set({ prompt })} className="font-display text-lg font-semibold" />
      <div className="grid gap-2 @md:grid-cols-2">
        {item.options.map((option, index) => {
          const right = index === item.answer
          return (
            <div key={index} className={cn('flex items-center gap-2 rounded-2xl border-2 p-1.5 transition-colors', right ? 'border-correct bg-correct-soft' : 'border-border')}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
                {index + 1}
              </span>
              <input
                aria-label={`Option ${index + 1}`}
                value={option}
                maxLength={LIMITS.option}
                placeholder={`Option ${index + 1} — a word or a short phrase`}
                onChange={(e) => set({ options: item.options.map((o, i) => (i === index ? e.target.value : o)) })}
                className="min-w-0 flex-1 bg-transparent px-1 font-semibold outline-none"
              />
              <motion.button
                type="button"
                aria-label={right ? `Option ${index + 1} is the answer` : `Make option ${index + 1} the answer`}
                aria-pressed={right}
                onClick={() => set({ answer: index })}
                whileTap={{ scale: 0.8 }}
                animate={right ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={spring.bouncy}
                className={cn('grid size-8 shrink-0 place-items-center rounded-full', right ? 'text-correct' : 'text-border hover:text-muted-foreground')}
              >
                <CheckCircle weight={right ? 'fill' : 'regular'} className="size-7" />
              </motion.button>
              {item.options.length > MIN_OPTIONS && (
                <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => remove(index)} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
                  <Trash weight="bold" className="size-4" />
                </button>
              )}
            </div>
          )
        })}
        {item.options.length < MAX_OPTIONS && (
          <button type="button" onClick={() => set({ options: [...item.options, ''] })} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-3 font-bold text-muted-foreground hover:border-hover-border hover:text-foreground">
            <Plus weight="bold" className="size-4" /> Add an option
          </button>
        )}
      </div>
      <LabelledText label="The buddy's hint" value={item.hint} limit={LIMITS.hint} placeholder="A nudge — never the answer" onChange={(hint) => set({ hint })} />
      <GrowingText label="Why this is the answer" value={item.explanation} maxLength={LIMITS.explanation} placeholder="Shown after answering" onChange={(explanation) => set({ explanation })} className="text-sm text-muted-foreground" />
      <div className="flex flex-wrap items-center gap-2">
        <SkillPicker value={item.skill} skills={skills} onChange={(skill) => set({ skill })} />
        <Segmented
          label="Difficulty"
          value={item.difficulty}
          onChange={(difficulty) => set({ difficulty })}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
          className="[&_button]:px-3 [&_button]:py-1 [&_button]:text-xs"
        />
      </div>
      <SourceToggles value={item.source_ids} sources={sources} onChange={(source_ids) => set({ source_ids })} />
    </div>
  )
}

const blankChapter = (n: number): GameChapter => ({ title: `Chapter ${n}`, intro: '', outro: '' })

/** A whole story and world from what the server sent, which may be partial. */
export function gameExtrasOf(raw: Partial<GameExtras>): GameExtras {
  const story: Partial<GameExtras['story']> = raw.story ?? {}
  return {
    title: raw.title ?? '',
    style: isStyle(raw.style) ? raw.style : 'quest',
    world: isWorld(raw.world) ? raw.world : 'rainforest',
    story: {
      hook: story.hook ?? '',
      goal: story.goal ?? '',
      chapters: [0, 1, 2].map((i) => ({ ...blankChapter(i + 1), ...story.chapters?.[i] })),
      win: story.win ?? '',
      retry: story.retry ?? '',
    },
    authored: raw.authored === true,
  }
}

export function GameExtrasEditor({ extras, onChange }: { extras: GameExtras; onChange: (extras: GameExtras) => void }) {
  const set = (patch: Partial<GameExtras>) => onChange({ ...extras, ...patch })
  const story = (patch: Partial<GameExtras['story']>) => set({ story: { ...extras.story, ...patch } })
  const chapter = (index: number, patch: Partial<GameChapter>) =>
    story({ chapters: extras.story.chapters.map((c, i) => (i === index ? { ...c, ...patch } : c)) })
  return (
    <div className="space-y-5">
      <LabelledText label="Game title" value={extras.title} limit={LIMITS.title} placeholder="A playful title" onChange={(title) => set({ title })} />
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How it is played</legend>
        <div className="mt-2 grid gap-2 @lg:grid-cols-2" role="radiogroup" aria-label="Game style">
          {STYLE_KEYS.map((key) => (
            <Choice key={key} on={extras.style === key} onClick={() => set({ style: key })} label={STYLES[key].label} blurb={STYLES[key].blurb} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Where it happens</legend>
        <div className="mt-2 grid gap-2 @lg:grid-cols-3" role="radiogroup" aria-label="Game world">
          {WORLD_KEYS.map((key) => (
            <Choice key={key} on={extras.world === key} onClick={() => set({ world: key })} label={WORLDS[key].label} blurb={WORLDS[key].blurb}>
              <span className="relative block h-16 overflow-hidden rounded-xl">
                <Backdrop world={key} motion="still" calm className="relative" />
              </span>
            </Choice>
          ))}
        </div>
      </fieldset>
      <p className="flex items-start gap-2 rounded-2xl bg-sky-100 px-3 py-2 text-sm text-sky-700 dark:bg-sky-700/30 dark:text-sky-100">
        <Info weight="fill" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">Write <b>{'{buddy}'}</b> where the player's own buddy should be named — Momo, Tompok, Kiko…</span>
      </p>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <LabelledText label="Opening scene" value={extras.story.hook} limit={LIMITS.hook} placeholder="How the adventure begins — read aloud at the start" onChange={(hook) => story({ hook })} />
        <LabelledText label="The mission" value={extras.story.goal} limit={LIMITS.goal} placeholder="What the player sets out to do" onChange={(goal) => story({ goal })} />
      </div>
      <div className="grid gap-3 @3xl:grid-cols-3">
        {extras.story.chapters.map((c, i) => (
          <div key={i} className="space-y-2 rounded-2xl border-2 border-border p-3">
            <GrowingText label={`Chapter ${i + 1} title`} value={c.title} maxLength={LIMITS.chapterTitle} placeholder={`Chapter ${i + 1}`} onChange={(title) => chapter(i, { title })} className="font-display font-semibold" />
            <LabelledText label="Begins" value={c.intro} limit={LIMITS.intro} placeholder="Leads into its challenges" onChange={(intro) => chapter(i, { intro })} />
            <LabelledText label="Ends" value={c.outro} limit={LIMITS.outro} placeholder="Celebrates it" onChange={(outro) => chapter(i, { outro })} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <LabelledText label="The happy ending" value={extras.story.win} limit={LIMITS.win} placeholder="Said when the game is finished" onChange={(win) => story({ win })} />
        <LabelledText label="Try again" value={extras.story.retry} limit={LIMITS.retry} placeholder="A warm word for another go" onChange={(retry) => story({ retry })} />
      </div>
    </div>
  )
}

function Choice({ on, onClick, label, blurb, children }: { on: boolean; onClick: () => void; label: string; blurb: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn('flex flex-col gap-2 rounded-2xl border-2 p-3 text-left transition-colors', on ? 'border-primary bg-selected' : 'border-border hover:border-hover-border hover:bg-hover')}
    >
      {children}
      <span className="font-display font-semibold">{label}</span>
      <span className="break-words text-sm text-muted-foreground">{blurb}</span>
    </button>
  )
}

const gameExtras: ExtrasEditor<GameExtras> = {
  Editor: GameExtrasEditor,
  from: (raw) => gameExtrasOf(raw as Partial<GameExtras>),
  title: 'Story and world',
}

export const gameEditor: KindEditor<GameItem> = {
  Editor: ChallengeEditor,
  extras: gameExtras as ExtrasEditor<unknown>,
  blank: (skill) => ({ id: '', prompt: '', options: ['', '', ''], answer: 0, explanation: '', hint: '', skill, difficulty: 'medium', source_ids: [] }),
  problem: (item) => {
    if (!item.prompt.trim()) return 'Write the challenge.'
    const options = item.options.map((o) => o.trim())
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return 'A challenge has two to four options.'
    if (options.some((o) => !o)) return 'Fill in every option.'
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return 'The options must all be different.'
    if (item.answer < 0 || item.answer >= options.length) return 'Mark the right option.'
    return null
  },
}
