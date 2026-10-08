/**
 * What only a game asks before it is built (§23): its story — Mentora's
 * surprise, a draft to read and edit, or the maker's own — and how and where
 * it is played: a style and a world, each with "Let Mentora decide".
 */
import { useState } from 'react'
import { Check, CirclesThree, MagicWand, MapTrifold, PencilSimpleLine, PersonSimpleRun, PuzzlePiece, Sparkle, type Icon } from '@phosphor-icons/react'
import { Alert, Button } from '@/components/ui'
import { errorMessage } from '@/features/auth/errors'
import { paint, STYLE_KEYS, STYLES, WORLD_KEYS, WORLDS } from '@/features/game/worlds/info'
import { cn } from '@/lib/utils'
import { learningApi, type GameChoices, type GameStyle, type GameWorld, type StoryDraftAsk } from './api'

export type StoryMode = 'surprise' | 'draft' | 'own'

export interface GameSetup {
  mode: StoryMode
  story: string
  style: GameStyle | 'auto'
  world: GameWorld | 'auto'
}

export const FRESH_GAME: GameSetup = { mode: 'surprise', story: '', style: 'auto', world: 'auto' }

/** As long as a story the server keeps (`LIMITS["story"]` in game.py). */
export const STORY_MAX = 2000

/** What is sent to be built: a surprise sends no story of its own. */
export function gameChoices(setup: GameSetup): GameChoices {
  return { style: setup.style, world: setup.world, story: setup.mode === 'surprise' ? '' : setup.story.trim() }
}

const AUTO_OPTION = { value: 'auto', label: 'Let Mentora decide', blurb: 'Picks what suits the topic and the age', Icon: Sparkle } as const
const STORY_MODES: ChoiceOption<StoryMode>[] = [
  { value: 'surprise', label: 'Surprise me', blurb: 'Written while the game is built — edit it after', Icon: Sparkle },
  { value: 'draft', label: 'Draft with AI', blurb: 'A story in seconds, to read and edit first', Icon: MagicWand },
  { value: 'own', label: 'Write my own', blurb: 'Your story — the game is built around it', Icon: PencilSimpleLine },
]
const STYLE_ICONS: Record<GameStyle, Icon> = { quest: MapTrifold, runner: PersonSimpleRun, catch: CirclesThree, match: PuzzlePiece }

/** A change to the setup, made from whatever it is by then — a draft that
 *  arrives late must not undo a style or world picked while it was coming. */
export type SetupChange = (update: (setup: GameSetup) => GameSetup) => void

export function GameOptions({ setup, onChange, ask }: { setup: GameSetup; onChange: SetupChange; ask: StoryDraftAsk }) {
  return (
    <div className="space-y-6">
      {/* Where first: a story drafted after is set there. */}
      <Choices
        label="How it plays"
        name="game-style"
        value={setup.style}
        onChange={(style) => onChange((s) => ({ ...s, style }))}
        options={[AUTO_OPTION, ...STYLE_KEYS.map((key) => ({ value: key, label: STYLES[key].label, blurb: STYLES[key].blurb, Icon: STYLE_ICONS[key] }))]}
      />
      <Choices
        label="Where it happens"
        name="game-world"
        value={setup.world}
        onChange={(world) => onChange((s) => ({ ...s, world }))}
        options={[AUTO_OPTION, ...WORLD_KEYS.map((key) => ({ value: key, label: WORLDS[key].label, blurb: WORLDS[key].blurb, swatch: key }))]}
      />
      <div className="space-y-3">
        <Choices label="The story" name="game-story" value={setup.mode} onChange={(mode) => onChange((s) => ({ ...s, mode }))} options={STORY_MODES} />
        {setup.mode !== 'surprise' && <StoryBox setup={setup} onChange={onChange} ask={ask} />}
      </div>
    </div>
  )
}

/** The story: a draft to ask for and edit, or a blank page to write on. */
function StoryBox({ setup, onChange, ask }: { setup: GameSetup; onChange: SetupChange; ask: StoryDraftAsk }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drafting = setup.mode === 'draft'
  const ready = ask.topic.trim().length >= 2

  async function draft() {
    setBusy(true)
    setError(null)
    try {
      const { story } = await learningApi.storyDraft(ask)
      onChange((s) => ({ ...s, story }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {drafting && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" loading={busy} disabled={!ready} onClick={() => void draft()}>
            {!busy && <MagicWand weight="bold" className="size-4" />}
            {setup.story ? 'Draft another' : 'Draft a story'}
          </Button>
          {!ready && <span className="text-sm text-muted-foreground">Say what it's about first.</span>}
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {(!drafting || setup.story) && (
        <>
          <textarea
            id="game-story"
            aria-label={drafting ? 'The drafted story — make it yours' : 'Your story'}
            rows={6}
            maxLength={STORY_MAX}
            value={setup.story}
            onChange={(e) => {
              const story = e.target.value
              onChange((s) => ({ ...s, story }))
            }}
            placeholder="Siti the turtle has lost her way home across the reef. Every right answer lights up the path…"
            className="w-full resize-y rounded-2xl border-2 border-input bg-surface px-3 py-2 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          />
          <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Write <code className="rounded bg-surface px-1 font-bold">{'{buddy}'}</code> wherever the player's own buddy should be.
            </span>
            <span className="tabular-nums">
              {setup.story.length} / {STORY_MAX}
            </span>
          </p>
        </>
      )}
    </div>
  )
}

interface ChoiceOption<T extends string> {
  value: T
  label: string
  blurb: string
  /** A world shows its colours; a style, its picture. */
  swatch?: GameWorld
  Icon?: Icon
}

/** Pick one — each choice named and explained, whole, wrapping onto as many rows as it needs. */
function Choices<T extends string>({ label, name, value, onChange, options }: { label: string; name: string; value: T; onChange: (value: T) => void; options: readonly ChoiceOption<T>[] }) {
  return (
    <section aria-labelledby={`${name}-label`}>
      <p id={`${name}-label`} className="mb-2 text-sm font-bold text-foreground/85">{label}</p>
      <div role="radiogroup" aria-labelledby={`${name}-label`} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <ChoiceTile key={option.value} option={option} on={option.value === value} onPick={() => onChange(option.value)} />
        ))}
      </div>
    </section>
  )
}

function ChoiceTile<T extends string>({ option, on, onPick }: { option: ChoiceOption<T>; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn('flex min-w-0 items-start gap-3 rounded-2xl border-2 bg-surface p-3 text-left transition-colors', on ? 'border-primary' : 'border-border hover:border-hover-border')}
    >
      <span
        aria-hidden
        className={cn('grid size-9 shrink-0 place-items-center rounded-xl', !option.swatch && 'bg-primary/10 text-primary')}
        style={option.swatch ? { background: `linear-gradient(160deg, ${paint(option.swatch, 'sky')}, ${paint(option.swatch, 'mid')} 70%, ${paint(option.swatch, 'ground')})` } : undefined}
      >
        {on ? <Check weight="bold" className={cn('size-4', option.swatch && 'text-white drop-shadow')} /> : option.Icon && <option.Icon weight="fill" className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block break-words font-bold leading-tight">{option.label}</span>
        <span className="mt-0.5 block break-words text-sm text-muted-foreground">{option.blurb}</span>
      </span>
    </button>
  )
}
