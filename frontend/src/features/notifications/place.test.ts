import { describe, expect, it } from 'vitest'
import { place } from './place'

const viewport = { width: 1280, height: 800 }

describe('place', () => {
  it('sits under the bell, lined up with its left edge', () => {
    const at = place({ left: 200, right: 240, bottom: 60 }, 400, 'left', viewport)
    expect(at).toEqual({ top: 68, left: 200, maxHeight: 720 })
  })

  it('lines up with the right edge when asked to', () => {
    const at = place({ left: 1200, right: 1240, bottom: 60 }, 400, 'right', viewport)
    expect(at.left).toBe(840)
  })

  it('is pulled back inside the window rather than running off it', () => {
    expect(place({ left: 1100, right: 1140, bottom: 60 }, 400, 'left', viewport).left).toBe(868)
    expect(place({ left: 0, right: 40, bottom: 60 }, 400, 'right', viewport).left).toBe(12)
  })

  it('keeps its margin in a window narrower than the panel', () => {
    expect(place({ left: 100, right: 140, bottom: 60 }, 400, 'left', { width: 300, height: 600 }).left).toBe(12)
  })

  it('never asks for a negative height', () => {
    expect(place({ left: 0, right: 40, bottom: 900 }, 400, 'left', viewport).maxHeight).toBe(0)
  })
})
