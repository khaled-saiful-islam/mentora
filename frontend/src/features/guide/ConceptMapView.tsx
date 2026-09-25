import { motion } from 'motion/react'
import { useMemo } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { layoutMap } from './map'

/**
 * How the guide's ideas fit together, drawn as it opens: the topic first,
 * lines reaching out, each part popping up, then the words to know. A part
 * can be tapped to jump straight to it.
 */
export function ConceptMapView({
  title,
  sections,
  onJump,
  className,
}: {
  title: string
  sections: { heading: string; terms: { term: string }[] }[]
  onJump?: (section: number) => void
  className?: string
}) {
  const calm = useCalmMotion()
  const roomy = useMediaQuery('(min-width: 640px)')
  const map = useMemo(() => layoutMap(title, sections), [title, sections])
  // A phone is too narrow for a ring of labels: they collide. The same map
  // becomes a trail from the topic down through its parts.
  if (!roomy) return <MapTrail title={title} sections={sections} onJump={onJump} className={className} />
  const nodes = map.nodes
  const shown = new Set(nodes.map((n) => n.id))
  const at = (id: string) => map.nodes.find((n) => n.id === id)
  const delay = (ring: number, index: number) => (calm ? 0 : ring === 0 ? 0 : ring === 1 ? 0.35 + index * 0.12 : 0.9 + index * 0.05)

  return (
    <div className={cn('relative w-full', className)} style={{ aspectRatio: `${map.width} / ${map.height}` }}>
      <svg viewBox={`0 0 ${map.width} ${map.height}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        {map.edges
          .filter((e) => shown.has(e.to))
          .map((edge, i) => {
            const from = at(edge.from)
            const to = at(edge.to)
            if (!from || !to) return null
            const outer = to.ring === 2
            return (
              <motion.line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                vectorEffect="non-scaling-stroke"
                className={outer ? 'stroke-kind-study-guide-vivid/40' : 'stroke-kind-study-guide-vivid/70'}
                strokeWidth={outer ? 1.5 : 2.5}
                strokeDasharray={outer ? '4 5' : undefined}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: calm ? 0 : 0.6, delay: calm ? 0 : 0.15 + i * 0.06 }}
              />
            )
          })}
      </svg>

      {nodes.map((node, i) => {
        const style = { left: `${(node.x / map.width) * 100}%`, top: `${(node.y / map.height) * 100}%` }
        const common = 'absolute -translate-x-1/2 -translate-y-1/2 text-center leading-tight'
        const motionProps = {
          initial: { opacity: 0, scale: 0.4 },
          animate: { opacity: 1, scale: 1 },
          transition: { ...spring.bouncy, delay: delay(node.ring, i) },
        }
        if (node.ring === 0) {
          return (
            <motion.div key={node.id} {...motionProps} style={style} className={cn(common, 'z-10 max-w-[34%] rounded-[1.5rem] bg-gradient-to-br from-kind-study-guide-vivid to-kind-study-guide px-4 py-3 font-display text-base font-bold text-white shadow-lg sm:text-xl')}>
              {node.label}
            </motion.div>
          )
        }
        if (node.ring === 1) {
          return (
            <motion.button
              key={node.id}
              type="button"
              {...motionProps}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => node.section !== undefined && onJump?.(node.section)}
              disabled={!onJump}
              style={style}
              className={cn(common, 'z-10 flex max-w-[30%] items-center gap-1.5 rounded-2xl border-2 border-kind-study-guide-vivid/50 bg-surface px-2.5 py-1.5 text-xs font-bold text-foreground shadow-md sm:text-sm', onJump && 'hover:border-kind-study-guide-vivid')}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-kind-study-guide-vivid text-[0.7rem] text-white">{(node.section ?? 0) + 1}</span>
              <span className="break-words text-left">{node.label}</span>
            </motion.button>
          )
        }
        return (
          <motion.span key={node.id} {...motionProps} style={style} className={cn(common, 'rounded-full bg-kind-study-guide-vivid/12 px-2 py-0.5 text-[0.7rem] font-bold text-kind-study-guide sm:text-xs')}>
            {node.label}
          </motion.span>
        )
      })}
    </div>
  )
}

function MapTrail({
  title,
  sections,
  onJump,
  className,
}: {
  title: string
  sections: { heading: string; terms: { term: string }[] }[]
  onJump?: (section: number) => void
  className?: string
}) {
  const calm = useCalmMotion()
  return (
    <div className={cn('relative', className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.bouncy}
        className="relative z-10 rounded-[1.25rem] bg-gradient-to-br from-kind-study-guide-vivid to-kind-study-guide px-4 py-3 text-center font-display text-lg font-bold text-white shadow-lg"
      >
        {title}
      </motion.div>
      <ol className="relative mt-2 space-y-2 pl-9">
        <motion.span
          aria-hidden
          className="absolute bottom-6 left-[1.05rem] top-0 w-0.5 origin-top rounded-full bg-kind-study-guide-vivid/50"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: calm ? 0 : 0.7, delay: calm ? 0 : 0.2 }}
        />
        {sections.map((section, i) => (
          <motion.li
            key={section.heading}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.gentle, delay: calm ? 0 : 0.3 + i * 0.1 }}
            className="relative"
          >
            <span aria-hidden className="absolute -left-[1.6rem] top-3.5 h-0.5 w-5 rounded-full bg-kind-study-guide-vivid/50" />
            <button
              type="button"
              onClick={() => onJump?.(i)}
              disabled={!onJump}
              className="flex w-full items-start gap-2.5 rounded-2xl border-2 border-kind-study-guide-vivid/40 bg-surface p-2.5 text-left shadow-sm"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-kind-study-guide-vivid text-xs font-bold text-white">{i + 1}</span>
              <span className="min-w-0">
                <span className="block break-words font-bold leading-snug">{section.heading}</span>
                {section.terms.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {section.terms.slice(0, 3).map((t) => (
                      <span key={t.term} className="rounded-full bg-kind-study-guide-vivid/12 px-2 py-0.5 text-xs font-bold text-kind-study-guide">
                        {t.term}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
