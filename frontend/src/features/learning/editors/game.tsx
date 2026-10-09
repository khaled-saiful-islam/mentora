/**
 * Editing a game (§26): each island — its idea and picture, what to do, the
 * template it is played in and its round (cards and baskets, steps, pairs,
 * each with its *why*), what it teaches and the buddy's hint — and the game's
 * story plan: its character, the opening and ending, a beat before and after
 * each island.
 *
 * Islands are a journey with a beat of the story before and after each, so
 * none is added, taken away or moved here. An island can be played in any
 * template it has a round for; *Rewrite with AI* ("make this a Line Up")
 * writes it a new one.
 */
import { Info } from '@phosphor-icons/react'
import { Segmented } from '@/components/ui/Segmented'
import { PLAY_LABELS, type Play } from '@/features/game/rounds'
import { isWorld, paint, WORLD_KEYS, WORLDS } from '@/features/game/worlds'
import { cn } from '@/lib/utils'
import type { GameExtras, GameItem, StoryBeat } from '../api'
import { StoryLines } from './storyLines'
import { GrowingText, LabelledText, SkillPicker, SourceToggles } from './fields'
import { MatchEditor, OrderEditor, SortEditor } from './rounds'
import type { ExtrasEditor, ItemEditorProps, KindEditor } from './types'

// The server's limits (`LIMITS` in app/learning/game.py), so nothing saved here
// is cut there.
export const LIMITS = {
  learn: 160,
  icon: 16,
  task: 160,
  explanation: 300,
  hint: 160,
  title: 80,
  hook: 600,
  storyGoal: 200,
  storyWin: 320,
  name: 40,
  about: 80,
}
const MOST_LINES = { opening: 3, ending: 2, before: 2, after: 2 }
const PLAYS: Play[] = ['sort', 'order', 'match']

function IslandEditor({ item, skills, sources, onChange }: ItemEditorProps<GameItem>) {
  const set = (patch: Partial<GameItem>) => onChange({ ...item, ...patch })
  const has = (play: Play) => Boolean(item[play])
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl bg-sky-100 p-2 dark:bg-sky-700/30">
        <input aria-label="Picture" value={item.icon} maxLength={LIMITS.icon} onChange={(e) => set({ icon: e.target.value })} className="size-14 shrink-0 rounded-xl bg-surface text-center text-3xl" />
        <div className="min-w-0 flex-1">
          <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Learn it — the one idea</p>
          <GrowingText label="Learn it" value={item.learn} maxLength={LIMITS.learn} placeholder="One idea, said simply" onChange={(learn) => set({ learn })} className="font-display text-lg font-semibold" />
        </div>
      </div>
      <LabelledText label="What to do" value={item.task} limit={LIMITS.task} placeholder="Sort what the plant takes in and gives out!" onChange={(task) => set({ task })} />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="How it plays"
          value={item.play}
          onChange={(play) => has(play) && set({ play })}
          options={PLAYS.map((play) => ({ value: play, label: PLAY_LABELS[play], disabled: !has(play) }))}
          className="[&_button]:px-3 [&_button]:py-1 [&_button]:text-xs"
        />
        {PLAYS.some((play) => !has(play)) && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">For another, Rewrite with AI: "make this a Line Up".</span>
          </p>
        )}
      </div>
      {item.play === 'sort' && item.sort && <SortEditor content={item.sort} onChange={(sort) => set({ sort })} />}
      {item.play === 'order' && item.order && <OrderEditor content={item.order} onChange={(order) => set({ order })} />}
      {item.play === 'match' && item.match && <MatchEditor content={item.match} onChange={(match) => set({ match })} />}
      <LabelledText label="What it teaches" value={item.explanation} limit={LIMITS.explanation} placeholder="Shown once the island is cleared" onChange={(explanation) => set({ explanation })} />
      <LabelledText label="The buddy's hint" value={item.hint} limit={LIMITS.hint} placeholder="A nudge — never the answer" onChange={(hint) => set({ hint })} />
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

/** What is missing from a round, in the words of the rule it breaks — the
 *  same rules the server keeps, so a game saved here plays. */
function roundProblem(item: GameItem): string | null {
  if (item.play === 'sort' && item.sort) {
    const { baskets, cards } = item.sort
    if (baskets.some((b) => !b.label.trim())) return 'Name every basket.'
    if (cards.some((c) => !c.text.trim())) return 'Write every card.'
    if (baskets.some((b) => !cards.some((c) => c.basket === b.id))) return 'Put a card in every basket.'
    if (new Set(cards.map((c) => c.text.trim().toLowerCase())).size < cards.length) return 'No two cards the same.'
    return null
  }
  if (item.play === 'order' && item.order) {
    const steps = item.order.steps
    if (steps.some((s) => !s.text.trim())) return 'Write every step.'
    if (new Set(steps.map((s) => s.text.trim().toLowerCase())).size < steps.length) return 'No two steps the same.'
    return null
  }
  const pairs = item.match?.pairs ?? []
  if (pairs.some((p) => !p.left.trim() || !p.right.trim())) return 'Fill both sides of every pair.'
  const sides = (side: 'left' | 'right') => new Set(pairs.map((p) => p[side].trim().toLowerCase())).size
  if (sides('left') < pairs.length || sides('right') < pairs.length) return 'No side of a pair said twice.'
  return null
}

/** A whole story and setting from what the server sent, which may be partial. */
export function gameExtrasOf(raw: Partial<GameExtras>): GameExtras {
  const story: Partial<GameExtras['story']> = raw.story ?? {}
  return {
    title: raw.title ?? '',
    world: isWorld(raw.world) ? raw.world : 'rainforest',
    character: { name: raw.character?.name ?? '', about: raw.character?.about ?? '' },
    story: {
      hook: story.hook ?? '',
      goal: story.goal ?? '',
      win: story.win ?? '',
      opening: story.opening ?? [],
      ending: story.ending ?? [],
    },
    beats: raw.beats ?? {},
    authored: raw.authored === true,
  }
}

export function GameExtrasEditor({ extras, onChange }: { extras: GameExtras; onChange: (extras: GameExtras) => void }) {
  const set = (patch: Partial<GameExtras>) => onChange({ ...extras, ...patch })
  const story = (patch: Partial<GameExtras['story']>) => set({ story: { ...extras.story, ...patch } })
  const beats = (island: string, beat: StoryBeat) => set({ beats: { ...extras.beats, [island]: beat } })
  const people = [extras.character.name || 'The character', '{buddy}']
  return (
    <div className="space-y-5">
      <LabelledText label="Game title" value={extras.title} limit={LIMITS.title} placeholder="A playful title" onChange={(title) => set({ title })} />
      <div className="grid gap-3 @2xl:grid-cols-2">
        <LabelledText label="Main character" value={extras.character.name} limit={LIMITS.name} placeholder="Atuk Hassan" onChange={(name) => set({ character: { ...extras.character, name } })} />
        <LabelledText label="Who they are" value={extras.character.about} limit={LIMITS.about} placeholder="a padi farmer in Kedah" onChange={(about) => set({ character: { ...extras.character, about } })} />
      </div>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Where it happens</legend>
        <p className="mt-1 text-sm text-muted-foreground">The treasure map is drawn in this world's colours.</p>
        <div className="mt-2 grid gap-2 @lg:grid-cols-3" role="radiogroup" aria-label="Setting">
          {WORLD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={extras.world === key}
              onClick={() => set({ world: key })}
              className={cn('flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors', extras.world === key ? 'border-primary bg-selected' : 'border-border hover:border-hover-border hover:bg-hover')}
            >
              <span aria-hidden className="size-9 shrink-0 rounded-xl" style={{ background: `linear-gradient(160deg, ${paint(key, 'sky')}, ${paint(key, 'mid')} 70%, ${paint(key, 'ground')})` }} />
              <span className="min-w-0">
                <span className="block font-display font-semibold">{WORLDS[key].label}</span>
                <span className="block break-words text-sm text-muted-foreground">{WORLDS[key].blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <p className="flex items-start gap-2 rounded-2xl bg-sky-100 px-3 py-2 text-sm text-sky-700 dark:bg-sky-700/30 dark:text-sky-100">
        <Info weight="fill" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">Write <b>{'{buddy}'}</b> where the player's own buddy should be named — Momo, Tompok, Kiko…</span>
      </p>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <LabelledText label="Opening" value={extras.story.hook} limit={LIMITS.hook} placeholder="How the game begins — read aloud at the start" onChange={(hook) => story({ hook })} />
        <LabelledText label="The goal" value={extras.story.goal} limit={LIMITS.storyGoal} placeholder="What the player sets out to do" onChange={(goal) => story({ goal })} />
      </div>
      <StoryLines label="Opening panel" lines={extras.story.opening} most={MOST_LINES.opening} people={people} onChange={(opening) => story({ opening })} />
      {Object.entries(extras.beats).map(([island, beat], n) => (
        <div key={island} className="grid gap-3 @2xl:grid-cols-2">
          <StoryLines label={`Before island ${n + 1}`} lines={beat.before} most={MOST_LINES.before} people={people} onChange={(before) => beats(island, { ...beat, before })} />
          <StoryLines label={`After island ${n + 1}`} lines={beat.after} most={MOST_LINES.after} people={people} onChange={(after) => beats(island, { ...beat, after })} />
        </div>
      ))}
      <LabelledText label="The happy ending" value={extras.story.win} limit={LIMITS.storyWin} placeholder="Said when every island is cleared" onChange={(win) => story({ win })} />
      <StoryLines label="Ending panel" lines={extras.story.ending} most={MOST_LINES.ending} people={people} onChange={(ending) => story({ ending })} />
    </div>
  )
}

const gameExtras: ExtrasEditor<GameExtras> = {
  Editor: GameExtrasEditor,
  from: (raw) => gameExtrasOf(raw as Partial<GameExtras>),
  title: 'Story and setting',
}

export const gameEditor: KindEditor<GameItem> = {
  Editor: IslandEditor,
  extras: gameExtras as ExtrasEditor<unknown>,
  blank: (skill) => ({
    id: '',
    learn: '',
    icon: '',
    play: 'match',
    task: '',
    match: { pairs: [] },
    explanation: '',
    hint: '',
    skill,
    difficulty: 'medium',
    source_ids: [],
  }),
  problem: (item) => {
    if (!item.learn.trim()) return 'Say the one idea it teaches.'
    if (!item.task.trim()) return 'Say what to do.'
    if (!item.explanation.trim()) return 'Say what the island teaches.'
    return roundProblem(item)
  },
  fixed: true,
}
