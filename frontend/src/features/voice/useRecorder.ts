/**
 * A tap-to-talk recorder: the microphone opens on the first tap and closes on
 * the second (or after half a minute), and what was said becomes a small WAV.
 * Nothing is recorded before the tap or after it; the mic light goes off the
 * moment it is done.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { loudness } from '@/features/live/audio/timing'
import { toWav } from './wav'

const LONGEST_MS = 30_000

export type RecorderState = 'idle' | 'listening' | 'working' | 'denied' | 'unsupported'

interface Parts {
  stream: MediaStream
  recorder: MediaRecorder
  chunks: Blob[]
  ctx: AudioContext
  frame: number
  timer: number
}

export function useRecorder(onClip: (wav: Blob) => Promise<void>) {
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
  const [state, setState] = useState<RecorderState>(supported ? 'idle' : 'unsupported')
  const [level, setLevel] = useState(0)
  const parts = useRef<Parts | null>(null)
  const clip = useRef(onClip)
  clip.current = onClip

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

  const stop = useCallback(async () => {
    const p = parts.current
    if (!p || p.recorder.state === 'inactive') return
    const done = new Promise<void>((resolve) => (p.recorder.onstop = () => resolve()))
    p.recorder.stop()
    await done
    const blob = new Blob(p.chunks, { type: p.recorder.mimeType || 'audio/webm' })
    setState('working')
    setLevel(0)
    try {
      const decoded = await p.ctx.decodeAudioData(await blob.arrayBuffer())
      await clip.current(toWav(decoded))
    } finally {
      release()
      setState('idle')
    }
  }, [release])

  const start = useCallback(async () => {
    if (parts.current || !supported) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setState('denied')
      return
    }
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
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
  }, [supported, stop])

  const toggle = useCallback(() => (parts.current ? stop() : start()), [start, stop])

  return { state, level, start, stop, toggle }
}
