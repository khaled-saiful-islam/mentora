import { describe, expect, it } from 'vitest'
import { MARGIN, placeBubble } from './bubblePlace'

const PHONE = { width: 360, height: 740 }
const BUBBLE = { width: 240, height: 70 }
const inside = (p: { left: number; top: number }, bubble = BUBBLE, screen = PHONE) =>
  p.left >= MARGIN && p.top >= MARGIN && p.left + bubble.width <= screen.width - MARGIN && p.top + bubble.height <= screen.height - MARGIN

describe('where a speech bubble goes', () => {
  it('sits above its buddy, centred, with the tail pointing down at it', () => {
    const p = placeBubble({ left: 130, top: 300, width: 100, height: 100 }, BUBBLE, PHONE, 'top')
    expect(p.tail).toBe('bottom')
    expect(p.left).toBe(60)
    expect(p.top).toBe(300 - 70 + 8)
    expect(p.tailAt).toBe(120)
  })

  it('slides inside the screen for a buddy near an edge, tail still on the buddy', () => {
    const right = placeBubble({ left: 270, top: 600, width: 84, height: 84 }, BUBBLE, PHONE, 'top')
    expect(inside(right)).toBe(true)
    expect(right.left + right.tailAt).toBeGreaterThan(270)
    const left = placeBubble({ left: 0, top: 300, width: 84, height: 84 }, BUBBLE, PHONE, 'top')
    expect(left.left).toBe(MARGIN)
    expect(inside(left)).toBe(true)
  })

  it('goes below a buddy at the top of the screen', () => {
    const p = placeBubble({ left: 130, top: 20, width: 100, height: 100 }, BUBBLE, PHONE, 'top')
    expect(p.tail).toBe('top')
    expect(p.top).toBeGreaterThan(20)
    expect(inside(p)).toBe(true)
  })

  it('reaches left from a corner buddy', () => {
    const p = placeBubble({ left: 268, top: 650, width: 84, height: 84 }, BUBBLE, PHONE, 'above-left')
    expect(p.left + BUBBLE.width).toBeLessThanOrEqual(PHONE.width - MARGIN)
    expect(inside(p)).toBe(true)
  })

  it('goes beside a buddy only when there is room, else above', () => {
    const roomy = placeBubble({ left: 700, top: 300, width: 120, height: 120 }, BUBBLE, { width: 1280, height: 800 }, 'left')
    expect(roomy.tail).toBe('right')
    expect(roomy.left + BUBBLE.width).toBeLessThanOrEqual(700 + 8)
    const cramped = placeBubble({ left: 40, top: 300, width: 120, height: 120 }, BUBBLE, PHONE, 'left')
    expect(cramped.tail).toBe('bottom')
    expect(inside(cramped)).toBe(true)
  })

  it('still fits a bubble as wide as a small screen allows', () => {
    const wide = { width: 336, height: 90 }
    const p = placeBubble({ left: 300, top: 400, width: 60, height: 60 }, wide, PHONE, 'top')
    expect(inside(p, wide)).toBe(true)
  })
})
