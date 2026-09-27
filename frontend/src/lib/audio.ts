/**
 * One AudioContext for the whole app — the little sounds and the tutor's
 * voice share it. Made on first use after the person has touched the page
 * (browsers refuse sound before that, and a buddy's hello on arrival would
 * only be blocked), and woken again if the browser put it to sleep (a tab in
 * the background, a phone that locked). Null where there is no Web Audio, or
 * no tap yet.
 */
let context: AudioContext | null = null

function touched(): boolean {
  // Where the browser cannot say, assume so; it will refuse quietly if not.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return activation ? activation.hasBeenActive : true
}

export function audioContext(): AudioContext | null {
  try {
    if (!context && !touched()) return null
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
    return context
  } catch {
    return null
  }
}
