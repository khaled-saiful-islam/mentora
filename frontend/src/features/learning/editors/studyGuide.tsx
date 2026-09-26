import { motion } from 'motion/react'
import { useState } from 'react'
import { Check, Images, Plus, Trash } from '@phosphor-icons/react'
import { PictureFrame } from '@/features/guide/PictureFrame'
import { LEVEL_LOOKS } from '@/features/guide/LevelSwitch'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import type { GuideExtras, GuidePicture, GuideSection, GuideTerm, QuizItem, ReadingLevel } from '../api'
import { GrowingText } from './fields'
import { quizEditor } from './quiz'
import type { ExtrasEditor, ItemEditorProps, KindEditor } from './types'

/** The same limits the server applies (`app/learning/study_guide.py`). */
const LIMITS = { heading: 90, simple: 900, core: 1600, stretch: 1600, point: 200, term: 60, meaning: 240, hook: 260, fact: 280, example: 400 }
const MOST_POINTS = 5
const MOST_TERMS = 5

type Tab = 'teach' | 'helpers' | 'picture' | 'check'
const TABS: { value: Tab; label: string }[] = [
  { value: 'teach', label: 'Teaching' },
  { value: 'helpers', label: 'Helpers' },
  { value: 'picture', label: 'Picture' },
  { value: 'check', label: 'Check' },
]

function SectionEditor({ item, skills, sources, onChange }: ItemEditorProps<GuideSection>) {
  const [tab, setTab] = useState<Tab>('teach')
  const set = (patch: Partial<GuideSection>) => onChange({ ...item, ...patch })
  return (
    <div className="space-y-3">
      <GrowingText label="Heading" value={item.heading} maxLength={LIMITS.heading} placeholder="What this part is about" onChange={(heading) => set({ heading })} className="font-display text-xl font-semibold" />
      <div role="tablist" aria-label="Part of the section" className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={cn('relative rounded-full px-3 py-1.5 text-sm font-bold', tab === t.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {tab === t.value && <motion.span layoutId={`guide-tab-${item.id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-surface shadow-sm" aria-hidden />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      {tab === 'teach' && <Teaching item={item} set={set} />}
      {tab === 'helpers' && <Helpers item={item} set={set} />}
      {tab === 'picture' && <PictureChooser item={item} set={set} />}
      {tab === 'check' && (
        <quizEditor.Editor
          item={item as unknown as QuizItem}
          skills={skills}
          sources={sources}
          onChange={(check) => onChange({ ...item, ...check })}
        />
      )}
    </div>
  )
}

type Set = (patch: Partial<GuideSection>) => void

function Teaching({ item, set }: { item: GuideSection; set: Set }) {
  const levels: ReadingLevel[] = ['core', 'simple', 'stretch']
  return (
    <div className="space-y-3">
      {levels.map((level) => {
        const { label, Icon, hint } = LEVEL_LOOKS[level]
        return (
          <div key={level} className="rounded-2xl border-2 border-border p-2">
            <p className="flex items-center gap-1.5 px-2 pt-1 text-sm font-bold">
              <Icon weight="fill" className="size-4 text-kind-study-guide" aria-hidden /> {label}
              <span className="font-normal text-muted-foreground">· {hint}</span>
            </p>
            <GrowingText
              label={`${label} version`}
              value={item.explain[level]}
              maxLength={LIMITS[level]}
              placeholder="Leave a blank line between paragraphs"
              onChange={(text) => set({ explain: { ...item.explain, [level]: text } })}
            />
          </div>
        )
      })}
    </div>
  )
}

function Helpers({ item, set }: { item: GuideSection; set: Set }) {
  return (
    <div className="space-y-4">
      <ListField label="Remember" noun="point" items={item.points} limit={LIMITS.point} most={MOST_POINTS} onChange={(points) => set({ points })} />
      <TermsField terms={item.terms} onChange={(terms) => set({ terms })} />
      <div className="grid gap-3 @xl:grid-cols-3">
        <LabelledText label="Remember it like this" value={item.hook} limit={LIMITS.hook} placeholder="A rhyme or a memory trick" onChange={(hook) => set({ hook })} />
        <LabelledText label="Did you know?" value={item.fact} limit={LIMITS.fact} placeholder="A surprising true fact" onChange={(fact) => set({ fact })} />
        <LabelledText label="In real life" value={item.example} limit={LIMITS.example} placeholder="Where this shows up in Malaysia" onChange={(example) => set({ example })} />
      </div>
    </div>
  )
}

function LabelledText({ label, value, limit, placeholder, onChange }: { label: string; value: string; limit: number; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl border-2 border-border p-2">
      <p className="px-2 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <GrowingText label={label} value={value} maxLength={limit} placeholder={placeholder} onChange={onChange} className="text-sm" />
    </div>
  )
}

function ListField({ label, noun, items, limit, most, onChange }: { label: string; noun: string; items: string[]; limit: number; most: number; onChange: (items: string[]) => void }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((text, i) => (
          <li key={i} className="flex items-center gap-1">
            <Check weight="bold" className="size-4 shrink-0 text-mint-400" aria-hidden />
            <GrowingText label={`${label} ${i + 1}`} value={text} maxLength={limit} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} className="text-sm" />
            <RemoveButton label={`Remove ${noun} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      {items.length < most && <AddButton label={`Add a ${noun}`} onClick={() => onChange([...items, ''])} />}
    </div>
  )
}

function TermsField({ terms, onChange }: { terms: GuideTerm[]; onChange: (terms: GuideTerm[]) => void }) {
  const change = (i: number, patch: Partial<GuideTerm>) => onChange(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Words to know</p>
      <ul className="mt-1 space-y-2">
        {terms.map((term, i) => (
          <li key={i} className="grid items-start gap-1 rounded-2xl border-2 border-border p-1.5 @xl:grid-cols-[10rem_1fr_9rem_auto]">
            <input aria-label={`Word ${i + 1}`} value={term.term} maxLength={LIMITS.term} placeholder="Word" onChange={(e) => change(i, { term: e.target.value })} className="rounded-xl bg-transparent px-2 py-1.5 font-bold outline-none focus-visible:bg-surface" />
            <GrowingText label={`Meaning of word ${i + 1}`} value={term.meaning} maxLength={LIMITS.meaning} placeholder="What it means" onChange={(meaning) => change(i, { meaning })} className="text-sm" />
            <input aria-label={`Translation of word ${i + 1}`} value={term.translation} maxLength={LIMITS.term} placeholder="In BM / English" onChange={(e) => change(i, { translation: e.target.value })} className="rounded-xl bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:bg-surface" />
            <RemoveButton label={`Remove word ${i + 1}`} onClick={() => onChange(terms.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      {terms.length < MOST_TERMS && <AddButton label="Add a word" onClick={() => onChange([...terms, { term: '', meaning: '', translation: '' }])} />}
    </div>
  )
}

/** The picture, and the others the search found, to swap in with a tap. */
function PictureChooser({ item, set }: { item: GuideSection; set: Set }) {
  const others = item.alternatives ?? []
  function choose(picture: GuidePicture) {
    const rest = [...(item.image ? [item.image] : []), ...others].filter((p) => p.image !== picture.image)
    set({ image: picture, alternatives: rest })
  }
  return (
    <div className="space-y-3">
      {item.image ? (
        <PictureFrame picture={item.image} alt={item.heading} drift={false} className="max-w-md" />
      ) : (
        <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No picture for this part yet.</p>
      )}
      {others.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Images weight="bold" className="size-4" aria-hidden /> Swap for another
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((picture) => (
              <button key={picture.image} type="button" onClick={() => choose(picture)} title={picture.title || picture.source} className="overflow-hidden rounded-xl ring-2 ring-transparent transition hover:ring-kind-study-guide-vivid">
                <img src={picture.thumbnail || picture.image} alt={picture.title || 'Another picture'} referrerPolicy="no-referrer" className="h-20 w-28 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {item.image && (
        <button type="button" onClick={() => set({ image: null, alternatives: [item.image as GuidePicture, ...others] })} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-destructive">
          <Trash weight="bold" className="size-4" /> Take the picture out
        </button>
      )}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-primary hover:bg-hover">
      <Plus weight="bold" className="size-4" /> {label}
    </button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
      <Trash weight="bold" className="size-4" />
    </button>
  )
}

// --- the opening and ending ----------------------------------------------------

export const BLANK_EXTRAS: GuideExtras = { big_question: '', intro: '', summary: [], challenge: null }

export function extrasOf(raw: Partial<GuideExtras>): GuideExtras {
  return { ...BLANK_EXTRAS, ...raw, summary: raw.summary ?? [], challenge: raw.challenge ?? null }
}

/** The guide's cover words and its ending, above its sections. */
export function GuideExtrasEditor({ extras, onChange }: { extras: GuideExtras; onChange: (extras: GuideExtras) => void }) {
  const set = (patch: Partial<GuideExtras>) => onChange({ ...extras, ...patch })
  const challenge = extras.challenge ?? { title: '', steps: [] }
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <div className="space-y-2">
        <LabelledText label="The big question" value={extras.big_question} limit={200} placeholder="A question that makes them want to read on" onChange={(big_question) => set({ big_question })} />
        <LabelledText label="Introduction" value={extras.intro} limit={700} placeholder="What the guide is about, and why it matters" onChange={(intro) => set({ intro })} />
      </div>
      <div className="space-y-3 rounded-2xl border-2 border-border p-3">
        <ListField label="The big ideas" noun="big idea" items={extras.summary} limit={220} most={6} onChange={(summary) => set({ summary })} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Try this!</p>
          <GrowingText label="Challenge title" value={challenge.title} maxLength={120} placeholder="Something to try at home or in class" onChange={(title) => set({ challenge: { ...challenge, title } })} className="font-bold" />
          <ListField label="Steps" noun="step" items={challenge.steps} limit={220} most={5} onChange={(steps) => set({ challenge: { ...challenge, steps } })} />
        </div>
      </div>
    </div>
  )
}

const guideExtras: ExtrasEditor<GuideExtras> = {
  Editor: GuideExtrasEditor,
  from: (raw) => extrasOf(raw as Partial<GuideExtras>),
  title: 'Cover and ending',
}

export const studyGuideEditor: KindEditor<GuideSection> = {
  Editor: SectionEditor,
  extras: guideExtras as ExtrasEditor<unknown>,
  previewable: true,
  blank: (skill) => ({
    id: '',
    heading: '',
    explain: { simple: '', core: '', stretch: '' },
    points: [],
    terms: [],
    hook: '',
    fact: '',
    example: '',
    image_query: '',
    image: null,
    alternatives: [],
    prompt: '',
    options: ['', '', '', ''],
    answer: 0,
    explanation: '',
    skill,
    difficulty: 'medium',
    source_ids: [],
  }),
  problem: (item) => {
    if (!item.heading.trim()) return 'Give this part a heading.'
    if (!item.explain.core.trim()) return 'Write the "Just right" version of the teaching.'
    if (item.terms.some((t) => !t.term.trim() || !t.meaning.trim())) return 'Every word to know needs its meaning.'
    return quizEditor.problem(item as unknown as QuizItem)
  },
}
