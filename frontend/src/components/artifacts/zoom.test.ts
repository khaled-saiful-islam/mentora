import { describe, expect, it } from 'vitest'
import { stepZoom, zoomLabel, ZOOM_STEPS } from './zoom'

describe('stepZoom', () => {
  it('moves one step at a time', () => {
    expect(stepZoom(1, 1)).toBe(1.25)
    expect(stepZoom(1.5, -1)).toBe(1.25)
  })

  it('stops at either end', () => {
    expect(stepZoom(1, -1)).toBe(1)
    expect(stepZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1], 1)).toBe(2)
  })

  it('snaps a value between steps before moving', () => {
    expect(stepZoom(1.3, 1)).toBe(1.5)
    expect(stepZoom(9, -1)).toBe(1.75)
  })
})

describe('zoomLabel', () => {
  it('calls the fitted size Fit and the rest a percentage', () => {
    expect(zoomLabel(1)).toBe('Fit')
    expect(zoomLabel(1.75)).toBe('175%')
  })
})
