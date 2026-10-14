/**
 * A yes-or-no kept on this device — the game's sound, remembered between
 * games (§28.3.2). Storage that fails or is empty gives the default.
 */
import { useCallback, useState } from 'react'

export function useDeviceFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const kept = window.localStorage.getItem(key)
      return kept === null ? fallback : kept === '1'
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Not remembered: this game still honours it.
      }
    },
    [key],
  )
  return [value, set]
}

/** Whether the page has been touched yet: before that, browsers refuse sound. */
export function touched(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return activation ? activation.hasBeenActive : true
}
