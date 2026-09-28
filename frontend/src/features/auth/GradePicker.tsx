import { motion } from 'motion/react'
import { Skeleton } from '@/components/ui'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { useGrades } from './useGrades'

const STAGE_TONES: Record<string, string> = {
  Primary: 'data-[on=true]:bg-sun-400 data-[on=true]:text-grape-900 data-[on=true]:border-sun-400',
  Secondary: 'data-[on=true]:bg-grape-600 data-[on=true]:text-white data-[on=true]:border-grape-600',
  'Pre-university': 'data-[on=true]:bg-sky-700 data-[on=true]:text-white data-[on=true]:border-sky-700',
}

/** Big, friendly grade chips grouped by stage — Year, Form, Sixth Form.
 *  `stages` limits which stages are offered (a student signing up picks
 *  from primary and secondary only). */
export function GradePicker({
  value,
  onChange,
  stages,
}: {
  value: string
  onChange: (code: string) => void
  stages?: readonly string[]
}) {
  const { groups: all, loading } = useGrades()
  const groups = stages ? all.filter((group) => stages.includes(group.stage)) : all

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Your grade" className="space-y-4">
      {groups.map((group) => (
        <div key={group.stage}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {group.stage}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.grades.map((grade) => {
              const on = grade.code === value
              return (
                <motion.button
                  key={grade.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-on={on}
                  onClick={() => onChange(grade.code)}
                  whileTap={{ scale: 0.92 }}
                  animate={on ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={spring.bouncy}
                  className={cn(
                    'h-12 rounded-2xl border-2 border-border bg-surface font-display text-base font-semibold',
                    'transition-colors hover:border-hover-border hover:bg-hover',
                    STAGE_TONES[group.stage],
                  )}
                >
                  {grade.label}
                </motion.button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
