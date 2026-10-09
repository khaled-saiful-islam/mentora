/**
 * The Lab's formulas (§26.8): the grammar the server reads the same way —
 * precedence, degrees, and NaN for anything that cannot be worked out.
 */
import { describe, expect, it } from 'vitest'
import { evaluate, parse, variablesOf } from './formula'

describe('a Lab formula', () => {
  it('reads numbers, names and the usual order of operations', () => {
    expect(evaluate('2 + 3 * 4', {})).toBe(14)
    expect(evaluate('(2 + 3) * 4', {})).toBe(20)
    expect(evaluate('.5 + 1.25', {})).toBe(1.75)
    expect(evaluate('10 - 4 - 3', {})).toBe(3)
    expect(evaluate('12 / 4 / 3', {})).toBe(1)
    expect(evaluate('v * v / r', { v: 6, r: 3 })).toBe(12)
  })

  it('raises right to left, tighter than a leading minus', () => {
    expect(evaluate('2 ^ 3 ^ 2', {})).toBe(512)
    expect(evaluate('-2^2', {})).toBe(-4)
    expect(evaluate('(-2)^2', {})).toBe(4)
    expect(evaluate('2^-1', {})).toBe(0.5)
    expect(evaluate('--3', {})).toBe(3)
  })

  it('works its angles in degrees, and knows pi', () => {
    expect(evaluate('sin(30)', {})).toBeCloseTo(0.5)
    expect(evaluate('cos(60)', {})).toBeCloseTo(0.5)
    expect(evaluate('tan(45)', {})).toBeCloseTo(1)
    expect(evaluate('2 * pi', {})).toBeCloseTo(6.2832, 3)
    expect(evaluate('v^2 * sin(2 * a) / 9.8', { v: 10, a: 45 })).toBeCloseTo(10.204, 2)
  })

  it('has roots, sizes, and the least or most of several', () => {
    expect(evaluate('sqrt(16) + abs(-3)', {})).toBe(7)
    expect(evaluate('min(4, 2, 8)', {})).toBe(2)
    expect(evaluate('max(light, water)', { light: 3, water: 9 })).toBe(9)
  })

  it('is NaN for what it cannot work out, never an error', () => {
    for (const bad of ['', '2 +', '(2 + 3', '2 ** 3', 'Light * 2', '5.', 'foo(2)', 'min(2)', 'sqrt(1, 2)', '2 3']) {
      expect(evaluate(bad, {}), bad).toBeNaN()
      expect(parse(bad), bad).toBeNull()
    }
    expect(evaluate('light * 2', {})).toBeNaN() // a name it was not given
    expect(evaluate('1 / (x - 2)', { x: 2 })).toBeNaN()
    expect(evaluate('sqrt(x)', { x: -1 })).toBeNaN()
    expect(evaluate('toString', {})).toBeNaN()
  })

  it('names the controls it reads', () => {
    expect(variablesOf('v^2 * sin(2 * a) / g + pi').sort()).toEqual(['a', 'g', 'v'])
    expect(variablesOf('2 +')).toEqual([])
  })
})
