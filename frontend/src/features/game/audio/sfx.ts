/**
 * The game's sound effects, synthesised like the music. Each is a handful of
 * shaped notes or a puff of noise — a coin for a right answer, a soft bonk
 * for a wrong one, a pop for a caught bubble, a whoosh for a lane change.
 * Never harsh: a child hears these hundreds of times.
 */
export type Effect =
  | 'right'
  | 'wrong'
  | 'combo'
  | 'pop'
  | 'whoosh'
  | 'snap'
  | 'tick'
  | 'step'
  | 'hint'
  | 'chapter'
  | 'boss'
  | 'victory'
  | 'start'

// [Hz, start s, length s, wave, gain]
type Note = [number, number, number, OscillatorType, number]

const TUNES: Partial<Record<Effect, Note[]>> = {
  right: [
    [988, 0, 0.09, 'square', 0.05],
    [1319, 0.07, 0.22, 'square', 0.05],
  ],
  wrong: [
    [330, 0, 0.16, 'sine', 0.14],
    [247, 0.12, 0.26, 'sine', 0.12],
  ],
  snap: [
    [180, 0, 0.08, 'triangle', 0.18],
    [720, 0, 0.04, 'square', 0.04],
  ],
  tick: [[1760, 0, 0.03, 'square', 0.025]],
  step: [[420, 0, 0.05, 'triangle', 0.05]],
  hint: [
    [1568, 0, 0.12, 'sine', 0.05],
    [2093, 0.08, 0.12, 'sine', 0.045],
    [2637, 0.16, 0.2, 'sine', 0.04],
  ],
  chapter: [
    [523, 0, 0.12, 'triangle', 0.1],
    [659, 0.12, 0.12, 'triangle', 0.1],
    [784, 0.24, 0.12, 'triangle', 0.1],
    [1047, 0.36, 0.42, 'triangle', 0.11],
  ],
  boss: [
    [147, 0, 0.45, 'sawtooth', 0.05],
    [196, 0.42, 0.6, 'sawtooth', 0.05],
  ],
  victory: [
    [523, 0, 0.14, 'triangle', 0.1],
    [659, 0.13, 0.14, 'triangle', 0.1],
    [784, 0.26, 0.14, 'triangle', 0.1],
    [1047, 0.39, 0.18, 'triangle', 0.11],
    [784, 0.6, 0.12, 'triangle', 0.09],
    [1047, 0.72, 0.6, 'triangle', 0.12],
    [1319, 0.72, 0.6, 'triangle', 0.07],
  ],
  start: [
    [392, 0, 0.1, 'triangle', 0.08],
    [784, 0.09, 0.3, 'triangle', 0.08],
  ],
}

function tone(ctx: AudioContext, out: AudioNode, [hz, start, length, wave, gain]: Note): void {
  const at = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(hz, at)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + length + 0.05)
}

let noiseBuffer: AudioBuffer | null = null

function noise(ctx: AudioContext, out: AudioNode, { length, from, to, gain }: { length: number; from: number; to: number; gain: number }): void {
  noiseBuffer ??= (() => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  })()
  const at = ctx.currentTime
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noiseBuffer
  filter.type = 'bandpass'
  filter.Q.value = 1.4
  filter.frequency.setValueAtTime(from, at)
  filter.frequency.exponentialRampToValueAtTime(to, at + length)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.02)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  src.connect(filter).connect(env).connect(out)
  src.start(at)
  src.stop(at + length + 0.05)
}

/** Plays an effect. `level` lifts a combo's chime as the run grows. */
export function playEffect(ctx: AudioContext, out: AudioNode, effect: Effect, level = 1): void {
  if (effect === 'pop') {
    noise(ctx, out, { length: 0.12, from: 2400, to: 600, gain: 0.12 })
    tone(ctx, out, [880, 0, 0.08, 'sine', 0.08])
    return
  }
  if (effect === 'whoosh') {
    noise(ctx, out, { length: 0.28, from: 400, to: 3200, gain: 0.07 })
    return
  }
  if (effect === 'combo') {
    const lift = 2 ** (Math.min(level, 8) / 12)
    for (const note of [[784, 0], [988, 0.07], [1175, 0.14], [1568, 0.21]] as const) {
      tone(ctx, out, [note[0] * lift, note[1], 0.14, 'triangle', 0.06])
    }
    return
  }
  for (const note of TUNES[effect] ?? []) tone(ctx, out, note)
}
