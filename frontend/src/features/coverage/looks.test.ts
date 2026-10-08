/**
 * Every kind of set a class can be given has a dot on the coverage map and
 * the family report — a kind without one would break the page it is on.
 */
import { describe, expect, it } from 'vitest'
import { LOOKS } from '@/features/learning/kinds'
import { KIND_DOTS } from './looks'

describe('coverage looks', () => {
  it('has a dot for every kind of set, and for live lessons', () => {
    for (const kind of [...Object.keys(LOOKS), 'live']) {
      expect(KIND_DOTS[kind as keyof typeof KIND_DOTS], kind).toBeDefined()
    }
  })
})
