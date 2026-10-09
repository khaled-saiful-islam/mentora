/**
 * Editing a game (§24, §25): each mission's words — its Learn it (the idea,
 * its picture-word, the control, what Try it asks), the Do it problem, when
 * it is reached, what it teaches, the buddy's hint — and the game's story
 * plan: its character, the opening and ending, a beat before and after each
 * mission.
 *
 * The missions are in the game's own code, so they are changed here in words
 * only: none added, none taken away, their order kept. To change the game
 * itself, *Change it* (`GameChanges`) asks for it to be rewritten and tested.
 */
import { Info } from '@phosphor-icons/react'
import { Segmented } from '@/components/ui/Segmented'
import { isWorld, paint, WORLD_KEYS, WORLDS } from '@/features/game/worlds'
import { cn } from '@/lib/utils'
import type { GameExtras, GameItem, StoryBeat } from '../api'
import { StoryLines } from './storyLines'
import { GrowingText, LabelledText, SkillPicker, SourceToggles } from './fields'
import type { ExtrasEditor, ItemEditorProps, KindEditor } from './types'

// The server's limits (`LIMITS` in app/learning/game.py), so nothing saved here
// is cut there.
export const LIMITS = {
  learn: 160,
  icon: 16,
  control: 40,
  guide: 120,
  goal: 160,
  win: 240,
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

function MissionEditor({ item, skills, sources, onChange }: ItemEditorProps<GameItem>) {
  const set = (patch: Partial<GameItem>) => onChange({ ...item, ...patch })
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl bg-sky-100 p-2 dark:bg-sky-700/30">
        <input aria-label="Picture" value={item.icon} maxLength={LIMITS.icon} onChange={(e) => set({ icon: e.target.value })} className="size-14 shrink-0 rounded-xl bg-surface text-center text-3xl" />
        <div className="min-w-0 flex-1">
          <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Learn it — the one idea</p>
          <GrowingText label="Learn it" value={item.learn} maxLength={LIMITS.learn} placeholder="One idea, said simply" onChange={(learn) => set({ learn })} className="font-display text-lg font-semibold" />
        </div>
      </div>
      <div className="grid gap-2 @md:grid-cols-2">
        <LabelledText label="The control it adds" value={item.control} limit={LIMITS.control} placeholder="the sun slider" onChange={(control) => set({ control })} />
        <LabelledText label="Try it — what to do" value={item.guide} limit={LIMITS.guide} placeholder="Slide the sun all the way up!" onChange={(guide) => set({ guide })} />
      </div>
      <LabelledText label="Do it — the problem" value={item.goal} limit={LIMITS.goal} placeholder="What the player makes happen" onChange={(goal) => set({ goal })} />
      <LabelledText label="Reached when" value={item.win} limit={LIMITS.win} placeholder="What the game checks" onChange={(win) => set({ win })} />
      <LabelledText label="What it teaches" value={item.explanation} limit={LIMITS.explanation} placeholder="Shown once the mission is reached" onChange={(explanation) => set({ explanation })} />
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
  const beats = (mission: string, beat: StoryBeat) => set({ beats: { ...extras.beats, [mission]: beat } })
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
        <p className="mt-1 text-sm text-muted-foreground">The game draws its own world: a new setting shows once you ask for it with Change it.</p>
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
      {Object.entries(extras.beats).map(([mission, beat], n) => (
        <div key={mission} className="grid gap-3 @2xl:grid-cols-2">
          <StoryLines label={`Before mission ${n + 1}`} lines={beat.before} most={MOST_LINES.before} people={people} onChange={(before) => beats(mission, { ...beat, before })} />
          <StoryLines label={`After mission ${n + 1}`} lines={beat.after} most={MOST_LINES.after} people={people} onChange={(after) => beats(mission, { ...beat, after })} />
        </div>
      ))}
      <LabelledText label="The happy ending" value={extras.story.win} limit={LIMITS.storyWin} placeholder="Said when every mission is done" onChange={(win) => story({ win })} />
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
  Editor: MissionEditor,
  extras: gameExtras as ExtrasEditor<unknown>,
  blank: (skill) => ({ id: '', learn: '', icon: '', control: '', guide: '', goal: '', win: '', explanation: '', hint: '', skill, difficulty: 'medium', source_ids: [] }),
  problem: (item) => {
    if (!item.learn.trim()) return 'Say the one idea it teaches.'
    if (!item.goal.trim()) return 'Write the mission.'
    if (!item.win.trim()) return 'Say when the mission is reached.'
    if (!item.explanation.trim()) return 'Say what the mission teaches.'
    return null
  },
  fixed: true,
}
