import { motion } from 'motion/react'
import { CheckCircle } from '@phosphor-icons/react'
import { Segmented } from '@/components/ui/Segmented'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import type { QuizItem } from '../api'
import { OPTION_LOOKS } from '../options'
import { GrowingText, SkillPicker, SourceToggles } from './fields'
import type { ItemEditorProps, KindEditor } from './types'

function QuizEditor({ item, skills, sources, onChange }: ItemEditorProps<QuizItem>) {
  const set = (patch: Partial<QuizItem>) => onChange({ ...item, ...patch })
  return (
    <div className="space-y-3">
      <GrowingText label="Question" value={item.prompt} maxLength={300} placeholder="Write the question" onChange={(prompt) => set({ prompt })} className="font-display text-lg font-semibold" />
      <div className="grid gap-2 @md:grid-cols-2">
        {item.options.map((option, index) => {
          const look = OPTION_LOOKS[index]
          const right = index === item.answer
          return (
            <div key={index} className={cn('flex items-center gap-2 rounded-2xl border-2 p-1.5 transition-colors', right ? 'border-correct bg-correct-soft' : 'border-border')}>
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', look.tile)} aria-hidden>
                <look.Shape weight="fill" className="size-4" />
              </span>
              <input
                aria-label={`Option ${look.letter}`}
                value={option}
                maxLength={160}
                placeholder={`Option ${look.letter}`}
                onChange={(e) => set({ options: item.options.map((o, i) => (i === index ? e.target.value : o)) })}
                className="min-w-0 flex-1 bg-transparent px-1 font-semibold outline-none"
              />
              <motion.button
                type="button"
                aria-label={right ? `Option ${look.letter} is the answer` : `Make option ${look.letter} the answer`}
                aria-pressed={right}
                onClick={() => set({ answer: index })}
                whileTap={{ scale: 0.8 }}
                animate={right ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={spring.bouncy}
                className={cn('grid size-8 shrink-0 place-items-center rounded-full', right ? 'text-correct' : 'text-border hover:text-muted-foreground')}
              >
                <CheckCircle weight={right ? 'fill' : 'regular'} className="size-7" />
              </motion.button>
            </div>
          )
        })}
      </div>
      <GrowingText label="Why this is the answer" value={item.explanation} maxLength={500} placeholder="Explain the answer (shown after answering)" onChange={(explanation) => set({ explanation })} className="text-sm text-muted-foreground" />
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

export const quizEditor: KindEditor<QuizItem> = {
  Editor: QuizEditor,
  blank: (skill) => ({ id: '', prompt: '', options: ['', '', '', ''], answer: 0, explanation: '', skill, difficulty: 'medium', source_ids: [] }),
  problem: (item) => {
    if (!item.prompt.trim()) return 'Write the question.'
    const options = item.options.map((o) => o.trim())
    if (options.some((o) => !o)) return 'Fill in all four options.'
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return 'The four options must all be different.'
    return null
  },
}
