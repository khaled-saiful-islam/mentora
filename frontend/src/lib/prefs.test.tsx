import { afterEach, describe, expect, it } from 'vitest'
import { applyToDocument, SIGNED_OUT } from './prefs'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-font')
  document.documentElement.removeAttribute('data-motion')
})

describe('applyToDocument', () => {
  it('sets the text scale as a multiplier and the font and motion attributes', () => {
    applyToDocument({ text_scale: 130, font_style: 'easy', motion: 'reduced', sound: false })
    const root = document.documentElement
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.3')
    expect(root.getAttribute('data-font')).toBe('easy')
    expect(root.getAttribute('data-motion')).toBe('reduced')
  })

  it('greets a signed-out visitor with the playful student look', () => {
    expect(SIGNED_OUT.font_style).toBe('playful')
    expect(SIGNED_OUT.text_scale).toBeGreaterThan(100)
    expect(SIGNED_OUT.sound).toBe(false)
  })
})
