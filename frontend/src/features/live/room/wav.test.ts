import { describe, expect, it } from 'vitest'
import { resample, toWav, WAV_RATE, wavBytes } from './wav'

function source(channels: Float32Array[], rate: number) {
  return {
    sampleRate: rate,
    numberOfChannels: channels.length,
    length: channels[0].length,
    getChannelData: (c: number) => channels[c],
  }
}

describe('a question as a WAV file', () => {
  it('writes a mono 16 kHz 16-bit PCM header', () => {
    const view = new DataView(wavBytes(source([new Float32Array(48_000)], 48_000)))
    const text = (at: number, n: number) => String.fromCharCode(...new Uint8Array(view.buffer, at, n))
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(WAV_RATE)
    expect(view.getUint16(34, true)).toBe(16)
    // One second at 48 kHz becomes one second at 16 kHz.
    expect(view.getUint32(40, true)).toBe(WAV_RATE * 2)
    expect(toWav(source([new Float32Array(10)], WAV_RATE)).type).toBe('audio/wav')
  })

  it('mixes stereo down to one channel', () => {
    const left = new Float32Array([1, 1, 1, 1])
    const right = new Float32Array([0, 0, 0, 0])
    const view = new DataView(wavBytes(source([left, right], WAV_RATE)))
    // Half of full scale: 0.5 × 32767, truncated as a 16-bit integer.
    expect(view.getInt16(44, true)).toBe(16383)
  })

  it('resamples by interpolating between neighbours', () => {
    expect(Array.from(resample(new Float32Array([0, 1, 0, 1]), 4, 2))).toEqual([0, 0])
    expect(resample(new Float32Array(300), 48_000, 16_000).length).toBe(100)
  })
})
