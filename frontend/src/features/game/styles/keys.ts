/**
 * The keyboard, for every style: 1–4 picks an option, and a style can listen
 * for the arrows as well. Ignored while typing somewhere, and while locked.
 */
import { useEffect, useRef } from 'react'

export interface Keys {
  /** A number key: the option, counted from 0. */
  pick?: (n: number) => void
  left?: () => void
  right?: () => void
  /** Enter, Space or the up arrow. */
  go?: () => void
}

export function useGameKeys(enabled: boolean, count: number, keys: Keys): void {
  const latest = useRef(keys)
  latest.current = keys
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const k = latest.current
      const digit = Number(event.key)
      if (Number.isInteger(digit) && digit >= 1 && digit <= count && k.pick) {
        event.preventDefault()
        k.pick(digit - 1)
      } else if (event.key === 'ArrowLeft' && k.left) {
        event.preventDefault()
        k.left()
      } else if (event.key === 'ArrowRight' && k.right) {
        event.preventDefault()
        k.right()
      } else if ((event.key === 'ArrowUp' || ((event.key === 'Enter' || event.key === ' ') && target?.tagName !== 'BUTTON')) && k.go) {
        event.preventDefault()
        k.go()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, count])
}
