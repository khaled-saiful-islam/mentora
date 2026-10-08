/**
 * Full screen for a game: the stage fills the screen and the browser's own
 * bars go. Where the browser cannot (an iPhone), the button is not offered —
 * the game already fills the window.
 */
import { useCallback, useEffect, useState } from 'react'

export function useFullscreen(target: React.RefObject<HTMLElement>) {
  const available = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const change = () => setOn(document.fullscreenElement === target.current && target.current !== null)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [target])
  // Leaving the game leaves full screen too.
  useEffect(() => () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [])
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void target.current?.requestFullscreen().catch(() => undefined)
  }, [target])
  return { available, on, toggle }
}
