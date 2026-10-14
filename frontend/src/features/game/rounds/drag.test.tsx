import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { targetAt, useMagnet } from './drag'

function over(attr: string, value: string) {
  const target = document.createElement('div')
  target.dataset[attr] = value
  const inner = document.createElement('span')
  target.append(inner)
  document.body.append(target)
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [inner, target] })
}

afterEach(() => {
  document.body.innerHTML = ''
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: undefined })
})

describe('dragging (§28.3.5)', () => {
  it('finds the target under the pointer, by mouse or by finger', () => {
    over('slot', 'p2')
    expect(targetAt(new MouseEvent('mouseup', { clientX: 5, clientY: 5 }), 'slot')).toBe('p2')
    const touch = { changedTouches: [{ clientX: 5, clientY: 5 }] } as unknown as TouchEvent
    expect(targetAt(touch, 'slot')).toBe('p2')
    expect(targetAt(new MouseEvent('mouseup'), 'basket')).toBeNull()
  })

  it('draws the target in while dragging, and knocks when a piece lands', () => {
    over('basket', 'b1')
    const sound = vi.fn()
    const { result } = renderHook(() => useMagnet('basket', sound))
    act(() => result.current.track(new MouseEvent('mousemove')))
    expect(result.current.near).toBe('b1')
    let landed: string | null = null
    act(() => {
      landed = result.current.drop(new MouseEvent('mouseup'))
    })
    expect(landed).toBe('b1')
    expect(result.current.near).toBeNull()
    expect(sound).toHaveBeenCalledWith('snap')
  })
})
