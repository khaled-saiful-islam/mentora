/**
 * A recorded question as a small WAV file: one channel, 16 kHz, 16-bit.
 * Every speech-to-text service reads WAV, and half a minute of it is well
 * under a megabyte — whatever the browser recorded in (webm, mp4, ogg).
 */

export interface PcmSource {
  sampleRate: number
  numberOfChannels: number
  length: number
  getChannelData: (channel: number) => Float32Array
}

export const WAV_RATE = 16_000

export function toWav(source: PcmSource, rate = WAV_RATE): Blob {
  return new Blob([wavBytes(source, rate)], { type: 'audio/wav' })
}

export function wavBytes(source: PcmSource, rate = WAV_RATE): ArrayBuffer {
  const mono = downmix(source)
  const samples = resample(mono, source.sampleRate, rate)
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true) // bytes per second
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return buffer
}

function downmix(source: PcmSource): Float32Array {
  if (source.numberOfChannels === 1) return source.getChannelData(0)
  const out = new Float32Array(source.length)
  for (let c = 0; c < source.numberOfChannels; c++) {
    const channel = source.getChannelData(c)
    for (let i = 0; i < source.length; i++) out[i] += channel[i] / source.numberOfChannels
  }
  return out
}

/** Linear interpolation: plenty for speech going to a recogniser. */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const length = Math.max(1, Math.round((input.length * to) / from))
  const out = new Float32Array(length)
  const step = from / to
  for (let i = 0; i < length; i++) {
    const at = i * step
    const low = Math.floor(at)
    const high = Math.min(input.length - 1, low + 1)
    const t = at - low
    out[i] = input[low] * (1 - t) + input[high] * t
  }
  return out
}
