/**
 * Every pairing the app puts text on is readable, in both themes.
 *
 * Read straight from theme.css, so tweaking a colour that breaks a pairing
 * fails here rather than in a child's eyes. 4.5:1 is WCAG AA for body text.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast } from '@/lib/contrast'

// jsdom's import.meta.url is not a file URL; tests run from the frontend root.
const CSS = readFileSync(resolvePath(process.cwd(), 'src/styles/theme.css'), 'utf8')

type Tokens = Record<string, string>

function block(selector: string): string {
  const start = CSS.indexOf(selector)
  if (start < 0) throw new Error(`no block ${selector}`)
  const open = CSS.indexOf('{', start + selector.length - 1)
  let depth = 0
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++
    if (CSS[i] === '}' && --depth === 0) return CSS.slice(open + 1, i)
  }
  throw new Error(`unclosed ${selector}`)
}

function tokensOf(body: string): Tokens {
  const found: Tokens = {}
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) found[match[1]] = match[2].trim()
  return found
}

const LIGHT = tokensOf(block(':root {'))
const DARK = { ...LIGHT, ...tokensOf(block('[data-theme="dark"] {')) }

function resolve(tokens: Tokens, name: string, depth = 0): string {
  const raw = tokens[name]
  if (raw === undefined) throw new Error(`no token --${name}`)
  const ref = raw.match(/^var\(--([\w-]+)\)$/)
  if (ref && depth < 8) return resolve(tokens, ref[1], depth + 1)
  return raw
}

/** "252 80% 56%" → "#5935e9" */
function hex(tokens: Tokens, name: string): string {
  const [h, s, l] = resolve(tokens, name).replace(/%/g, '').split(/\s+/).map(Number)
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const KINDS = ['quiz', 'flashcard', 'poster', 'slides', 'games', 'website', 'app']

const PAIRS: [text: string, ground: string][] = [
  ['foreground', 'background'],
  ['surface-foreground', 'surface'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'surface'],
  ['sidebar-foreground', 'sidebar'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['bubble-user-foreground', 'bubble-user'],
  ['success', 'surface'],
  ['destructive', 'surface'],
  ['primary', 'surface'],
  ...KINDS.map((kind): [string, string] => [`kind-${kind}`, 'surface']),
  ...KINDS.map((kind): [string, string] => [`kind-${kind}`, 'background']),
]

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
] as const)('%s theme', (_name, tokens) => {
  it.each(PAIRS)('%s is readable on %s', (text, ground) => {
    expect(contrast(hex(tokens, text), hex(tokens, ground))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('buttons', () => {
  it('ink reads on the sunshine button', () => {
    expect(contrast(hex(LIGHT, 'grape-900'), hex(LIGHT, 'sun-400'))).toBeGreaterThanOrEqual(4.5)
  })

  it('ink reads on the vivid answer colours', () => {
    for (const fill of ['mint-400', 'coral-400', 'sun-400']) {
      expect(contrast(hex(LIGHT, 'grape-900'), hex(LIGHT, fill))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
