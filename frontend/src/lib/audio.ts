/**
 * One AudioContext for the whole app — the little sounds and the tutor's
 * voice share it. Made on first use, which is a tap, so the browser lets it
 * play; woken again if the browser put it to sleep (a tab in the background,
 * a phone that locked). Null where there is no Web Audio at all.
 */
let context: AudioContext | null = null

export function audioContext(): AudioContext | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
    return context
  } catch {
    return null
  }
}
