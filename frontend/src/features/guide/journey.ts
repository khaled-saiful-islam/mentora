/**
 * Learn → Practise → Play (§28.3.8): what a study guide's own words make,
 * with no model call.
 *
 * - After each part, a one-minute round: a **Match Up** of its words to know
 *   (topped up with words met in earlier parts, so a part with two words
 *   still has a game), and a **Line Up** of the process it describes, when
 *   it describes one (`steps`).
 * - At the end, the guide's **Boss Battle**: "What does … mean?" for words
 *   from every part, as a game's boss is made from its pairs
 *   (`game_finish.py`).
 *
 * Seeded by the guide, so a reader sees the same rounds each visit.
 */
import type { BossContent, BossQuestion, MatchContent, OrderContent } from '@/features/game/rounds/types'
import type { GuideTerm } from '@/features/learning/api'

export type PartRound = { play: 'match'; content: MatchContent } | { play: 'order'; content: OrderContent }

/** What a part needs to have rounds: its id, its words and its steps. */
export interface PartWords {
  id: string
  terms: GuideTerm[]
  steps?: string[]
}

// As many pairs and steps as a Match Up and a Line Up take (`game_rounds.py`).
const PAIRS = { least: 3, most: 4 }
const STEPS = { least: 3, most: 6 }
const BOSS = { least: 4, most: 6 }
const CHOICES = 4

const WORDS = {
  en: { means: (t: string, m: string) => `"${t}" means: ${m}`, after: (s: string) => `This comes after "${s}".`, ask: (t: string) => `What does "${t}" mean?`, boss: 'The Muddle Monster' },
  ms: { means: (t: string, m: string) => `"${t}" bermaksud: ${m}`, after: (s: string) => `Ini datang selepas "${s}".`, ask: (t: string) => `Apakah maksud "${t}"?`, boss: 'Raksasa Kelam-kabut' },
}

const wordsFor = (language: string) => (language === 'ms' ? WORDS.ms : WORDS.en)

/** Each word once, by the word, with a meaning. */
function distinctTerms(terms: GuideTerm[]): GuideTerm[] {
  const seen = new Set<string>()
  return terms.filter((t) => {
    const key = t.term.trim().toLowerCase()
    if (!key || !t.meaning.trim() || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The rounds after part `index`: a Match Up, a Line Up, both, or neither. */
export function partRounds(parts: PartWords[], index: number, language: string): PartRound[] {
  const part = parts[index]
  if (!part) return []
  const rounds: PartRound[] = []
  const match = matchFor(parts, index, language)
  if (match) rounds.push({ play: 'match', content: match })
  const order = orderFor(part, language)
  if (order) rounds.push({ play: 'order', content: order })
  return rounds
}

function matchFor(parts: PartWords[], index: number, language: string): MatchContent | null {
  const own = distinctTerms(parts[index].terms)
  if (own.length === 0) return null
  // Words met before, the latest first, to make up a game.
  const earlier = parts.slice(0, index).reverse().flatMap((p) => p.terms)
  const terms = distinctTerms([...own, ...earlier])
  const meanings = new Set<string>()
  const pairs = terms
    .filter((t) => {
      const key = t.meaning.trim().toLowerCase()
      if (meanings.has(key)) return false
      meanings.add(key)
      return true
    })
    .slice(0, PAIRS.most)
  if (pairs.length < PAIRS.least) return null
  const say = wordsFor(language)
  return { pairs: pairs.map((t, n) => ({ id: `${parts[index].id}-p${n + 1}`, left: t.term, right: t.meaning, why: say.means(t.term, t.meaning) })) }
}

function orderFor(part: PartWords, language: string): OrderContent | null {
  const steps = (part.steps ?? []).map((s) => s.trim()).filter(Boolean)
  if (steps.length < STEPS.least || steps.length > STEPS.most || new Set(steps).size !== steps.length) return null
  const say = wordsFor(language)
  return { steps: steps.map((text, n) => ({ id: `${part.id}-s${n + 1}`, text, icon: '', why: n > 0 ? say.after(steps[n - 1]) : '' })) }
}

/** The guide's Boss Battle, or null when it has too few words to ask about. */
export function guideBoss(parts: PartWords[], language: string): BossContent | null {
  const say = wordsFor(language)
  const byPart = parts.map((p) => distinctTerms(p.terms))
  const all = distinctTerms(byPart.flat())
  const meanings = [...new Set(all.map((t) => t.meaning))]
  if (all.length < BOSS.least || meanings.length < CHOICES) return null
  const random = seeded(parts.map((p) => p.id).join(' '))
  const asked = spread(byPart, BOSS.most, random)
  const questions: BossQuestion[] = asked.map((term, n) => {
    const wrong = pickSome(meanings.filter((m) => m !== term.meaning), CHOICES - 1, random)
    const options = pickSome([term.meaning, ...wrong], CHOICES, random)
    return { id: `q${n + 1}`, ask: say.ask(term.term), options, answer: options.indexOf(term.meaning), why: say.means(term.term, term.meaning) }
  })
  return questions.length >= BOSS.least ? { name: say.boss, icon: '👾', questions } : null
}

/** Up to `most` words, taken from every part in turn, each word once. */
function spread(byPart: GuideTerm[][], most: number, random: () => number): GuideTerm[] {
  const queues = byPart.map((terms) => pickSome(terms, terms.length, random))
  const picked: GuideTerm[] = []
  const seen = new Set<string>()
  while (picked.length < most && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift()
      if (!next || picked.length >= most) continue
      const key = next.term.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      picked.push(next)
    }
  }
  return picked
}

/** `count` of `items` in a random order, on a copy. */
function pickSome<T>(items: readonly T[], count: number, random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, count)
}

/** A small random number source that gives the same numbers for the same seed. */
function seeded(seed: string): () => number {
  let state = 2166136261
  for (let i = 0; i < seed.length; i += 1) state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
