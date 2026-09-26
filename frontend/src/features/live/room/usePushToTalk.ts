/**
 * Push-to-talk for the student Astra has called on. The microphone is opened
 * only while the button is held, and closed the moment it is let go; what
 * was said is turned into a small WAV and handed on. Nothing is recorded
 * before, after, or for anyone who has not been called on.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { loudness } from '../audio/timing'
import { toWav } from './wav'

const LONGEST_MS = 30_000

export type TalkState = 'idle' | 'listening' | 'sending' | 'denied'

export function usePushToTalk(onClip: (wav: Blob) => Promise<void>) {
  const [state, setState] = useState<TalkState>('idle')
  const [level, setLevel] = useState(0)
  const parts = useRef<{ stream: MediaStream; recorder: MediaRecorder; chunks: Blob[]; ctx: AudioContext; frame: number; timer: number } | null>(null)

  const release = useCallback(() => {
    const p = parts.current
    parts.current = null
    if (!p) return
    cancelAnimationFrame(p.frame)
    window.clearTimeout(p.timer)
    p.stream.getTracks().forEach((t) => t.stop())
    void p.ctx.close().catch(() => undefined)
  }, [])

  useEffect(() => release, [release])

  const start = useCallback(async () => {
    if (parts.current || state === 'sending') return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setState('denied')
      return
    }
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      setLevel(loudness(samples))
      if (parts.current) parts.current.frame = requestAnimationFrame(tick)
    }
    parts.current = { stream, recorder, chunks, ctx, frame: requestAnimationFrame(tick), timer: window.setTimeout(() => void stop(), LONGEST_MS) }
    recorder.start()
    setState('listening')
    // `stop` is defined below and only ever called after `start` has run.
  }, [state])

  const stop = useCallback(async () => {
    const p = parts.current
    if (!p || p.recorder.state === 'inactive') return
    const done = new Promise<void>((resolve) => (p.recorder.onstop = () => resolve()))
    p.recorder.stop()
    await done
    const blob = new Blob(p.chunks, { type: p.recorder.mimeType || 'audio/webm' })
    const decoder = p.ctx
    setState('sending')
    setLevel(0)
    try {
      const decoded = await decoder.decodeAudioData(await blob.arrayBuffer())
      await onClip(toWav(decoded))
    } finally {
      release()
      setState('idle')
    }
  }, [onClip, release])

  return { state, level, start, stop }
}
