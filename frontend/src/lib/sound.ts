/**
 * Little sounds for playing — a chime for right, a soft bonk for wrong —
 * synthesised on the spot, so there are no audio files to load. Off unless
 * the person turned sound on in their settings.
 */
import { useCallback } from 'react'
import { usePreferences } from './prefs'

export type Sound = 'tap' | 'correct' | 'wrong' | 'flip' | 'streak' | 'finish' | 'badge'

// [frequency Hz, start s, length s, wave]
type Note = [number, number, number, OscillatorType]

const TUNES: Record<Sound, Note[]> = {
  tap: [[660, 0, 0.06, 'triangle']],
  correct: [
    [660, 0, 0.12, 'triangle'],
    [988, 0.09, 0.2, 'triangle'],
  ],
  wrong: [
    [320, 0, 0.14, 'sine'],
    [240, 0.1, 0.22, 'sine'],
  ],
  flip: [
    [520, 0, 0.05, 'triangle'],
    [780, 0.04, 0.07, 'triangle'],
  ],
  streak: [
    [660, 0, 0.1, 'triangle'],
    [880, 0.08, 0.1, 'triangle'],
    [1175, 0.16, 0.22, 'triangle'],
  ],
  finish: [
    [523, 0, 0.14, 'triangle'],
    [659, 0.12, 0.14, 'triangle'],
    [784, 0.24, 0.14, 'triangle'],
    [1047, 0.36, 0.34, 'triangle'],
  ],
  badge: [
    [880, 0, 0.1, 'sine'],
    [1320, 0.08, 0.1, 'sine'],
    [1760, 0.16, 0.3, 'sine'],
  ],
}

let context: AudioContext | null = null

export function playSound(sound: Sound): void {
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    for (const [frequency, start, length, wave] of TUNES[sound]) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = wave
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
      osc.connect(gain).connect(context.destination)
      osc.start(now + start)
      osc.stop(now + start + length + 0.05)
    }
  } catch {
    // No audio (a locked-down browser, a test): a silent game is still a game.
  }
}

/** Plays a sound if the person has sound on. */
export function useSound(): (sound: Sound) => void {
  const { prefs } = usePreferences()
  return useCallback((sound: Sound) => {
    if (prefs.sound) playSound(sound)
  }, [prefs.sound])
}
