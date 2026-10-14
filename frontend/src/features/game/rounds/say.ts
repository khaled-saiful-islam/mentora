/**
 * Say It (§28.3.5): which words of a line came through when a child read it
 * aloud, and how to say one again a bit at a time.
 *
 * Matching forgives what an ear and an accent do to a word: case, marks,
 * a vowel heard as another ("ramo" for "rama"), a letter or two out in a
 * long word, a word heard as two ("rama-rama" as "rama rama"). It never
 * accepts a different word with a few letters in common, and order matters:
 * a word heard after the next one does not count for this one.
 */

export interface WordHeard {
  word: string
  heard: boolean
}

// Letters and digits at a word's edges are kept; anything else goes, as the
// server counts words (`say_words` in `game_rounds.py`).
const EDGES = /^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu
const VOWELS = /[aeiou]/g
// How far ahead in what was heard a word may be found: a skipped word or two.
const LOOKAHEAD = 2

/** A line's words, as they are shown and counted. */
export function wordsOf(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(EDGES, ''))
    .filter(Boolean)
}

function fold(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, n) => n)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = row
  }
  return previous[b.length]
}

/** The consonants, in order: what is left of a word when its vowels slip. */
const skeleton = (word: string) => word.replace(VOWELS, '')

/** Whether `heard` is `expected`, said by a child and heard by a machine. */
export function sameWord(expected: string, heard: string): boolean {
  const e = fold(expected)
  const h = fold(heard)
  if (!e || !h) return false
  if (e === h) return true
  if (e.length <= 3) return e[0] === h[0] && h.length <= e.length + 1 && distance(e, h) <= 1
  const allowed = Math.max(1, Math.floor(e.length / 3))
  if (distance(e, h) <= allowed) return true
  const bones = skeleton(e)
  return bones.length >= 2 && bones === skeleton(h) && Math.abs(e.length - h.length) <= 1
}

/** Each word of `expected`, heard or not, in what the child was heard to say. */
export function matchWords(expected: string, heard: string): WordHeard[] {
  const said = wordsOf(heard)
  let from = 0
  return wordsOf(expected).map((word) => {
    for (let k = from; k < Math.min(said.length, from + 1 + LOOKAHEAD); k += 1) {
      if (sameWord(word, said[k])) {
        from = k + 1
        return { word, heard: true }
      }
      // "rama-rama" heard as two words, or one word heard in two halves.
      if (k + 1 < said.length && sameWord(word, said[k] + said[k + 1])) {
        from = k + 2
        return { word, heard: true }
      }
    }
    return { word, heard: false }
  })
}

// Two letters that are one sound: "ng" in "sungai", "sy" in "syukur".
const DIGRAPHS = ['ng', 'ny', 'sy', 'kh', 'gh', 'sh', 'ch', 'th', 'ph', 'wh', 'ck']
// Two vowels said as one at the end of a Malay word: "sungai", "pulau".
const ENDINGS = ['ai', 'au', 'oi']

/**
 * A word in syllables, to say again slowly: "petani" → "pe-ta-ni",
 * "berenang" → "be-re-nang". Exact for Malay, which is written as it is
 * said; a fair guide for English.
 */
export function syllables(word: string, language: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '')
  if (letters.length < 4) return word
  const units = unitsOf(letters, language)
  const nuclei = units.map((u, n) => (isVowel(u, n, units, language) ? n : -1)).filter((n) => n >= 0)
  if (nuclei.length < 2) return word
  const cuts: number[] = []
  for (let i = 0; i + 1 < nuclei.length; i += 1) {
    const between = nuclei[i + 1] - nuclei[i] - 1
    // No consonant: between the vowels. One: before it. More: after the first.
    cuts.push(nuclei[i] + 1 + (between >= 2 ? 1 : 0))
  }
  const parts: string[] = []
  let start = 0
  for (const cut of cuts) {
    parts.push(units.slice(start, cut).join(''))
    start = cut
  }
  parts.push(units.slice(start).join(''))
  return parts.join('-')
}

/** Letters as sounds: a digraph is one, and so is a Malay word's last diphthong. */
function unitsOf(letters: string, language: string): string[] {
  const units: string[] = []
  for (let i = 0; i < letters.length; i += 1) {
    const two = letters.slice(i, i + 2)
    const ending = language === 'ms' && i === letters.length - 2 && ENDINGS.includes(two)
    if (DIGRAPHS.includes(two) || ending) {
      units.push(two)
      i += 1
    } else units.push(letters[i])
  }
  return units
}

function isVowel(unit: string, n: number, units: string[], language: string): boolean {
  if (/^[aeiou]/.test(unit)) {
    // English drops a last "e" after a consonant: "rate" is one syllable.
    const silent = language !== 'ms' && unit === 'e' && n === units.length - 1 && n > 0 && !/[aeiou]/.test(units[n - 1])
    return !silent && !(n > 0 && /^[aeiou]$/.test(units[n - 1]) && language !== 'ms')
  }
  // "y" is a vowel inside or at the end of an English word: "fly", "happy".
  return unit === 'y' && n > 0 && language !== 'ms'
}
