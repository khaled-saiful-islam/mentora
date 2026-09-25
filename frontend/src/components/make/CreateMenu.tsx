import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { GROUPS, type Creatable } from './creatables'

/**
 * "Create" in a conversation: one button in the box's toolbar, next to Attach
 * and Search, instead of two rows of chips sitting over the box. It opens a
 * tidy menu of everything that can be made, grouped.
 */
export function CreateMenu({ items, onPick }: { items: Creatable[]; onPick: (item: Creatable) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const calm = useCalmMotion()

  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
          open ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-hover',
        )}
      >
        <motion.span
          animate={calm || open ? { rotate: 0, scale: 1 } : { rotate: [0, 18, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 1.6, repeat: calm || open ? 0 : Infinity, repeatDelay: 3.5 }}
          className="grid place-items-center"
        >
          <Sparkle weight="fill" className="size-4" aria-hidden />
        </motion.span>
        Create
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Create something"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
            className="absolute bottom-11 left-0 z-30 max-h-[min(34rem,70vh)] w-[min(24rem,calc(100vw-2.5rem))] origin-bottom-left overflow-y-auto rounded-[1.5rem] border border-border bg-surface p-2 shadow-xl"
          >
            {GROUPS.map((group) => {
              const inGroup = items.filter((i) => i.group === group.key)
              if (!inGroup.length) return null
              return (
                <div key={group.key} className="py-1">
                  <p className="px-3 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  {inGroup.map((item, i) => (
                    <motion.button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0, transition: { ...spring.gentle, delay: i * 0.03 } }}
                      onClick={() => {
                        setOpen(false)
                        onPick(item)
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
                      style={{ ['--tile' as string]: item.colour }}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tile)_16%,transparent)]" style={{ color: 'var(--tile)' }}>
                        <item.Icon weight="duotone" className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold leading-tight">{item.label}</span>
                        <span className="block text-sm leading-snug text-muted-foreground">{item.blurb}</span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
