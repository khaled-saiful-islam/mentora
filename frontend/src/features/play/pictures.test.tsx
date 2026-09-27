import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayBackendProvider, type PlayBackend } from './backend'
import { QuestionPicture } from './PlayFun'
import { GRACE_MS, inTime, POLL_MS, preload, useItemPictures, type ItemPicture, type ItemPictures, type ReadyPicture } from './pictures'

// The frame only asks whether motion is calm; no preferences needed here.
vi.mock('@/motion', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/motion')>()), useCalmMotion: () => false }))

const PHOTO: ItemPicture = { image: 'https://pics.test/ok.jpg', thumbnail: 'https://pics.test/ok-small.jpg', page: 'https://pics.test/', source: 'pics.test', alt: 'a grassy field' }

// A browser image that "loads" by its address: …bad fails, …tiny is too small.
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  referrerPolicy = ''
  set src(value: string) {
    setTimeout(() => {
      if (value.includes('bad')) return this.onerror?.()
      this.naturalWidth = value.includes('tiny') ? 40 : 400
      this.onload?.()
    }, 0)
  }
}

beforeEach(() => vi.stubGlobal('Image', FakeImage))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('in time for its question', () => {
  const ready = (at: number): ReadyPicture => ({ ...PHOTO, at })

  it('shows a picture ready before the question, or just after', () => {
    expect(inTime(ready(900), 1000)).toBe(true)
    expect(inTime(ready(1000 + GRACE_MS), 1000)).toBe(true)
  })

  it('keeps a late picture back, so the answers do not jump', () => {
    expect(inTime(ready(1001 + GRACE_MS), 1000)).toBe(false)
    expect(inTime(undefined, 1000)).toBe(false)
  })
})

describe('loading a picture before it is shown', () => {
  it("falls back to the search's own copy when the picture will not load", async () => {
    expect(await preload(PHOTO)).toBe(PHOTO.image)
    expect(await preload({ ...PHOTO, image: 'https://pics.test/bad.jpg' })).toBe(PHOTO.thumbnail)
    expect(await preload({ ...PHOTO, image: 'https://pics.test/tiny.jpg' })).toBe(PHOTO.thumbnail)
  })

  it('gives up when neither loads', async () => {
    expect(await preload({ ...PHOTO, image: 'https://pics.test/bad.jpg', thumbnail: '' })).toBeNull()
  })
})

describe('asking for pictures while playing', () => {
  function wrapper(pictures: PlayBackend['pictures']) {
    const backend: PlayBackend = { answer: vi.fn(), speech: () => '', pictures }
    return ({ children }: { children: ReactNode }) => <PlayBackendProvider value={backend}>{children}</PlayBackendProvider>
  }

  it('asks again until the server is done, and keeps what it found', async () => {
    vi.useFakeTimers()
    const replies: ItemPictures[] = [
      { pictures: {}, done: false },
      { pictures: { q1: PHOTO, q2: { ...PHOTO, image: 'bad', thumbnail: 'bad' } }, done: true },
    ]
    const pictures = vi.fn(async () => replies.shift() ?? { pictures: {}, done: true })
    const { result } = renderHook(() => useItemPictures('a1', true), { wrapper: wrapper(pictures) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS + 10)
    })
    expect(pictures).toHaveBeenCalledTimes(2)
    expect(Object.keys(result.current).sort()).toEqual(['q1', 'q2'])
    expect(result.current.q1.image).toBe(PHOTO.image)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    })
    expect(pictures).toHaveBeenCalledTimes(2)
  })

  it('asks for nothing in a look without pictures', async () => {
    const pictures = vi.fn(async () => ({ pictures: {}, done: true }))
    renderHook(() => useItemPictures('a1', false), { wrapper: wrapper(pictures) })
    await act(async () => undefined)
    expect(pictures).not.toHaveBeenCalled()
  })
})

describe('the picture frame', () => {
  it("tries the search's small copy, then steps aside rather than show a broken picture", () => {
    const { container } = render(<QuestionPicture picture={{ ...PHOTO, at: 0 }} />)
    const img = screen.getByRole('img', { name: 'a grassy field' })
    expect(img.getAttribute('src')).toBe(PHOTO.image)
    expect(screen.getByRole('link', { name: 'pics.test' }).getAttribute('href')).toBe(PHOTO.page)
    fireEvent.error(img)
    expect(screen.getByRole('img', { name: 'a grassy field' }).getAttribute('src')).toBe(PHOTO.thumbnail)
    fireEvent.error(screen.getByRole('img', { name: 'a grassy field' }))
    expect(container.querySelector('figure')).toBeNull()
  })

  it('credits the site without a link on a card, which is a button already', () => {
    render(<QuestionPicture picture={{ ...PHOTO, at: 0 }} on="card" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('pics.test')).toBeTruthy()
  })
})
