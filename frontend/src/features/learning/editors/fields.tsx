import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Skill, Source } from '../api'

/** A textarea that grows with what is typed — no inner scrollbars. */
export function GrowingText({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength: number
  className?: string
  label: string
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={box}
      rows={1}
      aria-label={label}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full resize-none overflow-hidden rounded-2xl border-2 border-transparent bg-transparent px-3 py-2 transition-colors',
        'hover:border-border focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none',
        className,
      )}
    />
  )
}

export function SkillPicker({ value, skills, onChange }: { value: string; skills: Skill[]; onChange: (slug: string) => void }) {
  return (
    <select
      aria-label="Skill"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold focus-visible:border-primary focus-visible:outline-none"
    >
      {skills.map((s) => (
        <option key={s.slug} value={s.slug}>{s.label}</option>
      ))}
    </select>
  )
}

export function SourceToggles({ value, sources, onChange }: { value: string[]; sources: Source[]; onChange: (ids: string[]) => void }) {
  if (sources.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">From</span>
      {sources.map((s) => {
        const on = value.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            title={s.title}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((id) => id !== s.id) : [...value, s.id])}
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors', on ? 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100' : 'bg-muted text-muted-foreground hover:bg-hover')}
          >
            {s.id} · {s.host}
          </button>
        )
      })}
    </div>
  )
}
