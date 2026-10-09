/**
 * Editing a Boss Battle (§26.8): the boss — its name and picture — and its
 * questions, each with three or four options, the right one picked, and the
 * *why* the buddy says when a wrong one is chosen. Four to eight questions, as
 * the server keeps (`BOSS_QUESTIONS` in app/learning/game_rounds.py).
 */
import { Plus, Trash } from '@phosphor-icons/react'
import type { BossContent, BossQuestion } from '@/features/game/rounds'
import { GrowingText } from './fields'

export const BOSS_LIMITS = { name: 40, ask: 200, option: 120, why: 220, icon: 16 }
const QUESTIONS = [4, 8] as const
const OPTIONS = [3, 4] as const

export function BossEditor({ content, onChange }: { content: BossContent; onChange: (content: BossContent) => void }) {
  const questions = content.questions
  const set = (id: string, patch: Partial<BossQuestion>) => onChange({ ...content, questions: questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) })
  const add = () => onChange({ ...content, questions: [...questions, { id: freshId(questions), ask: '', options: ['', '', ''], answer: 0, why: '' }] })
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <input aria-label="The boss's picture" value={content.icon} maxLength={BOSS_LIMITS.icon} onChange={(e) => onChange({ ...content, icon: e.target.value })} className="size-11 shrink-0 rounded-xl bg-surface text-center text-2xl" />
        <div className="min-w-0 flex-1 rounded-2xl border-2 border-border p-1">
          <GrowingText label="The boss's name" value={content.name} maxLength={BOSS_LIMITS.name} placeholder="Captain Muddle" onChange={(name) => onChange({ ...content, name })} />
        </div>
      </div>
      <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Questions</legend>
        <ol className="space-y-2">
          {questions.map((question, n) => (
            <Question
              key={question.id}
              number={n + 1}
              question={question}
              onChange={(patch) => set(question.id, patch)}
              onRemove={questions.length > QUESTIONS[0] ? () => onChange({ ...content, questions: questions.filter((q) => q.id !== question.id) }) : null}
            />
          ))}
        </ol>
        {questions.length < QUESTIONS[1] && (
          <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
            <Plus weight="bold" className="size-4" /> Add a question
          </button>
        )}
      </fieldset>
    </div>
  )
}

function Question({ number, question, onChange, onRemove }: { number: number; question: BossQuestion; onChange: (patch: Partial<BossQuestion>) => void; onRemove: (() => void) | null }) {
  const setOption = (o: number, text: string) => onChange({ options: question.options.map((option, i) => (i === o ? text : option)) })
  const dropOption = (o: number) => onChange({ options: question.options.filter((_, i) => i !== o), answer: question.answer > o ? question.answer - 1 : question.answer === o ? 0 : question.answer })
  return (
    <li className="space-y-1.5 rounded-xl bg-muted/40 p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <GrowingText label={`Question ${number}`} value={question.ask} maxLength={BOSS_LIMITS.ask} placeholder="The question" onChange={(ask) => onChange({ ask })} className="font-semibold" />
        </div>
        {onRemove && (
          <button type="button" aria-label={`Remove question ${number}`} onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
            <Trash weight="bold" className="size-4" />
          </button>
        )}
      </div>
      <div role="radiogroup" aria-label={`Question ${number}: the right answer`} className="grid gap-1.5 @md:grid-cols-2">
        {question.options.map((option, o) => (
          <div key={o} className="flex min-w-0 items-center gap-1.5 rounded-xl bg-surface p-1">
            <input type="radio" name={`boss-${question.id}`} aria-label={`Option ${o + 1} is right`} checked={question.answer === o} onChange={() => onChange({ answer: o })} className="ml-2 size-5 shrink-0 accent-primary" />
            <div className="min-w-0 flex-1">
              <GrowingText label={`Question ${number}, option ${o + 1}`} value={option} maxLength={BOSS_LIMITS.option} placeholder={`Option ${o + 1}`} onChange={(text) => setOption(o, text)} className="text-sm" />
            </div>
            {question.options.length > OPTIONS[0] && (
              <button type="button" aria-label={`Remove option ${o + 1}`} onClick={() => dropOption(o)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
                <Trash weight="bold" className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {question.options.length < OPTIONS[1] && (
        <button type="button" onClick={() => onChange({ options: [...question.options, ''] })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-primary hover:bg-primary/10">
          <Plus weight="bold" className="size-4" /> Add an option
        </button>
      )}
      <GrowingText label={`Question ${number}: why`} value={question.why} maxLength={BOSS_LIMITS.why} placeholder="Why — said when a wrong one is picked" onChange={(why) => onChange({ why })} className="text-sm text-muted-foreground" />
    </li>
  )
}

function freshId(taken: { id: string }[]): string {
  const ids = new Set(taken.map((q) => q.id))
  let n = taken.length + 1
  while (ids.has(`q${n}`)) n += 1
  return `q${n}`
}
