import { describe, expect, it } from 'vitest'
import { sizeLine, type Material } from './api'
import { lookOfMaterial } from './MaterialBits'

const file = (over: Partial<Material>): Material => ({
  id: 'm1', title: 'Leaf notes', filename: 'leaf.pdf', kind: 'pdf', size_bytes: 2_500_000,
  unit: 'pages', unit_count: 12, preview: '', created_at: '', updated_at: '', ...over,
})

describe('a material at a glance', () => {
  it('says its size and length the way a teacher would', () => {
    expect(sizeLine(file({}))).toBe('2.4 MB · 12 pages')
    expect(sizeLine(file({ size_bytes: 3000, unit: 'slides', unit_count: 1 }))).toBe('3 KB · 1 slide')
    expect(sizeLine(file({ size_bytes: 3000, unit: 'line', unit_count: 5 }))).toBe('3 KB · 5 lines')
    expect(sizeLine(file({ size_bytes: 900_000, kind: 'image', unit: 'image', unit_count: 1 }))).toBe('Photo')
  })

  it('wears its file type, and a plain look for anything else', () => {
    expect(lookOfMaterial('pptx').label).toBe('Slides')
    expect(lookOfMaterial('odt').label).toBe('Text')
  })
})
