import { describe, expect, it } from 'vitest'
import { strengthOf } from './PasswordStrength'

describe('strengthOf', () => {
  it('is zero below the minimum length', () => expect(strengthOf('abc1234')).toBe(0))
  it('is okay at the minimum', () => expect(strengthOf('abcdefgh')).toBe(1))
  it('rewards variety', () => expect(strengthOf('abcdEFGH')).toBe(2))
  it('rewards length and variety together', () => expect(strengthOf('Abcdefgh12!')).toBe(3))
  it('rewards a long passphrase', () => expect(strengthOf('correcthorsebattery')).toBe(3))
})
