import { useEffect, useState, type RefObject } from 'react'

/** Whether a play area is too narrow to give each of `count` columns `min`
 *  pixels — the cue for a style to lay its answers out another way rather
 *  than shrink or overlap their words. */
export function useNarrow(area: RefObject<HTMLElement>, count: number, min: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = area.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width / count < min))
    watch.observe(el)
    return () => watch.disconnect()
  }, [area, count, min])
  return narrow
}
