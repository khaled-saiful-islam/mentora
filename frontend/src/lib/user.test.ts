import { describe, expect, it } from 'vitest'
import { can, firstName, nameOf, type User } from './user'

const base = { display_name: null, username: null, email: null }

describe('names', () => {
  it('prefers the display name, then the sign-in name', () => {
    expect(nameOf({ ...base, display_name: 'Adam Tan', username: 'adam' })).toBe('Adam Tan')
    expect(nameOf({ ...base, username: 'adam' })).toBe('adam')
    expect(nameOf({ ...base, email: 'cikgu@school.my' })).toBe('cikgu@school.my')
    expect(nameOf(base)).toBe('You')
  })

  it('greets by first name', () => {
    expect(firstName({ ...base, display_name: 'Siti Nur Aisyah' })).toBe('Siti')
  })
})

describe('can', () => {
  it('reads the capability the server sent, and is false for nobody', () => {
    const student = { capabilities: { studio_artifacts: false, join_classes: true } } as unknown as User
    expect(can(student, 'join_classes')).toBe(true)
    expect(can(student, 'studio_artifacts')).toBe(false)
    expect(can(null, 'join_classes')).toBe(false)
  })
})
