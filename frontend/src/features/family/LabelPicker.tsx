/**
 * Who you are to the child — Mum, Dad, Guardian, or in your own words. It
 * is what the child sees: "Mum sent you a quiz".
 */
import { motion } from 'motion/react'
import { useState } from 'react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { LABELS } from './api'

export function LabelPicker({ value, onChange, childName }: { value: string; onChange: (label: string) => void; childName?: string }) {
  const preset = (LABELS as readonly string[]).includes(value)
  const [own, setOwn] = useState(!preset && value !== '')
  return (
    <fieldset className="space-y-2">
      <legend className="select-none text-sm font-bold text-foreground/85">
        {childName ? `What does ${childName} call you?` : 'Who are you to your child?'}
      </legend>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {[...LABELS, 'Something else'].map((label) => {
          const on = label === 'Something else' ? own : !own && value === label
          return (
            <motion.button
              key={label}
              type="button"
              role="radio"
              aria-checked={on}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
              onClick={() => {
                if (label === 'Something else') {
                  setOwn(true)
                  onChange('')
                } else {
                  setOwn(false)
                  onChange(label)
                }
              }}
              className={cn(
                'rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors',
                on ? 'border-transparent bg-kind-family-vivid text-white shadow-press' : 'border-border bg-surface hover:border-hover-border',
              )}
            >
              {label}
            </motion.button>
          )
        })}
      </div>
      {own && (
        <Input
          aria-label="What they call you"
          autoFocus
          maxLength={24}
          placeholder="e.g. Nenek, Uncle Ravi"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </fieldset>
  )
}
