/**
 * Pictures beside the questions, for the Year 1–3 look
 * (docs/features/045-question-pictures.md).
 *
 * The server hands over what it has found so far and keeps looking for the
 * rest, so this asks again every few seconds until it says it is done. A
 * question only shows a picture that was known as it appeared (or very soon
 * after), so the answers never jump under a child's finger; its space is kept
 * while the photo loads (`QuestionPicture`), and each one is fetched ahead so
 * it is usually in the browser's cache by its turn.
 */
import { useEffect, useRef, useState } from 'react'
import { usePlayBackend } from './backend'

export interface ItemPicture {
  image: string
  thumbnail: string
  page: string
  source: string
  /** What the picture is of, for a screen reader. */
  alt: string
}

export interface ItemPictures {
  pictures: Record<string, ItemPicture>
  done: boolean
}

export interface ReadyPicture extends ItemPicture {
  /** When it became known here. */
  at: number
}

export const POLL_MS = 3000
/** Stop asking after this many tries, done or not. */
export const MAX_POLLS = 30
/** A picture that turns up this soon after its question is still shown. */
export const GRACE_MS = 2500
/** Smaller than this is a thumbnail too small to be worth showing. */
const MIN_WIDTH = 120

function load(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!src) return resolve(false)
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => resolve(img.naturalWidth >= MIN_WIDTH)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/** The first of the picture and its thumbnail that loads, or null. */
export async function preload(picture: ItemPicture): Promise<string | null> {
  for (const src of [picture.image, picture.thumbnail]) {
    if (await load(src)) return src
  }
  return null
}

/** Pictures for this attempt's items, as they become known. Off: nothing. */
export function useItemPictures(attemptId: string, on: boolean): Record<string, ReadyPicture> {
  const backend = usePlayBackend()
  const [ready, setReady] = useState<Record<string, ReadyPicture>>({})

  useEffect(() => {
    if (!on) return
    let stopped = false
    let timer = 0
    const tried = new Set<string>()

    async function poll(round: number) {
      const got = await backend.pictures(attemptId).catch(() => null)
      if (stopped) return
      const fresh = Object.entries(got?.pictures ?? {}).filter(([id]) => !tried.has(id))
      if (fresh.length) {
        const at = Date.now()
        for (const [id, picture] of fresh) {
          tried.add(id)
          // Fetched ahead, into the browser's cache; the frame shows it later.
          void preload(picture)
        }
        setReady((now) => ({ ...now, ...Object.fromEntries(fresh.map(([id, picture]) => [id, { ...picture, at }])) }))
      }
      if (got && !got.done && round + 1 < MAX_POLLS) timer = window.setTimeout(() => void poll(round + 1), POLL_MS)
    }

    void poll(0)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [attemptId, on, backend])

  return ready
}

/** Whether a picture belongs on a question first seen at `seenAt`. */
export function inTime(picture: ReadyPicture | undefined, seenAt: number, grace = GRACE_MS): picture is ReadyPicture {
  return Boolean(picture) && (picture as ReadyPicture).at <= seenAt + grace
}

/** The picture for the item on screen — only if it was ready in time. */
export function usePictureFor(ready: Record<string, ReadyPicture>, itemId: string | undefined): ReadyPicture | null {
  const seen = useRef<Record<string, number>>({})
  if (!itemId) return null
  seen.current[itemId] ??= Date.now()
  const picture = ready[itemId]
  return inTime(picture, seen.current[itemId]) ? picture : null
}
