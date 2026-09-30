import { describe, expect, it } from 'vitest'
import type { BuddyBrief } from './brief'
import { finishTip, homeLines, HOW_TO, kindLine, linesFor, placeOf, playTip, spoken } from './companion'

const now = new Date(2026, 8, 30, 10, 0)

function brief(over: Partial<BuddyBrief> = {}): BuddyBrief {
  return {
    name: 'Aina', streak: 3, badges: 2, waiting: [], waiting_count: 0, overdue: 0, due_soon: 0,
    strengths: ['Light energy'], practise: ['Water'], recent: [], kinds: [], next_lesson: null, ...over,
  }
}

describe('where the buddy is', () => {
  it('knows each page by its path', () => {
    expect(placeOf('/')).toBe('home')
    expect(placeOf('/results')).toBe('results')
    expect(placeOf('/room/abc')).toBe('room')
    expect(placeOf('/leaderboard/a1')).toBe('leaderboard')
    expect(placeOf('/settings')).toBe('other')
  })
})

describe('what the buddy says on a page', () => {
  it('tells a student what is overdue and what is due soon, anywhere', () => {
    const lines = linesFor('other', brief({
      waiting: [
        { title: 'Fractions', kind: 'quiz', due_at: new Date(2026, 8, 29, 9, 0).toISOString(), overdue: true },
        { title: 'The Water Cycle', kind: 'study_guide', due_at: new Date(2026, 8, 30, 15, 0).toISOString(), overdue: false },
      ],
      waiting_count: 2, overdue: 1, due_soon: 1,
    }), now)
    expect(lines[0]).toBe('"Fractions" is overdue. Shall we do it now? I\'ll help!')
    expect(lines[1]).toMatch(/^"The Water Cycle" is due today at 3:00/)
  })

  it('talks results through on the results page: the last score, strengths and what to practise', () => {
    const lines = linesFor('results', brief({
      recent: [{ title: 'Plants', kind: 'quiz', percent: 90 }],
      kinds: [{ kind: 'flashcard', average: 45, count: 4 }],
    }), now, 0)
    expect(lines).toContain('90% on "Plants"! That\'s brilliant.')
    expect(lines).toContain('You\'re really strong at "Light energy"!')
    expect(lines).toContain('"Water" needs a bit more practice. You\'ll find some under Practice.')
    expect(lines).toContain(`Flashcards have felt tricky lately. Try this: ${HOW_TO.flashcard[0]}`)
  })

  it('points practice at the weakest skill', () => {
    expect(linesFor('practice', brief(), now)[0]).toBe('Let\'s practise "Water". A round on it will help it stick.')
  })

  it('knows the next live lesson, and how to do well in one', () => {
    const lesson = { id: 'l1', title: 'Plants', status: 'scheduled', scheduled_at: new Date(2026, 9, 1, 9, 0).toISOString() }
    const lines = linesFor('schedule', brief({ next_lesson: lesson }), now, 0)
    expect(lines[0]).toMatch(/^Your live lesson "Plants" is tomorrow at 9:00/)
    expect(lines[1]).toBe(`Live lesson tip: ${HOW_TO.live[0]}`)
    expect(linesFor('room', brief(), now, 0).every((line) => line.startsWith('Tip: '))).toBe(true)
  })

  it('leaves home and the buddy page to the buddy already there', () => {
    expect(linesFor('home', brief(), now)).toEqual([])
    expect(linesFor('buddy', brief(), now)).toEqual([])
  })
})

describe('tips for doing better', () => {
  it('praises what goes well and helps with what feels hard', () => {
    expect(kindLine({ kind: 'quiz', average: 91, count: 5 })).toBe('Your quizzes are going brilliantly lately: 91% on average!')
    expect(kindLine({ kind: 'study_guide', average: 50, count: 2 }, 0)).toBe(`Study guides have felt tricky lately. Try this: ${HOW_TO.study_guide[0]}`)
  })

  it('starts a set with what it knows about its skills', () => {
    expect(playTip('quiz', ['Water'], brief())).toMatch(/^This one has "Water" in it/)
    expect(playTip('quiz', ['Light energy'], brief())).toMatch(/^"Light energy"\? You're great at this!/)
    expect(playTip('flashcard', ['Sound'], brief({ kinds: [{ kind: 'flashcard', average: 40, count: 3 }] }), 0)).toMatch(/^Flashcards have felt tricky/)
    expect(playTip('quiz', ['Sound'], brief())).toBeNull()
    expect(playTip('quiz', ['Water'], null)).toBeNull()
  })

  it('says what to practise next after a finish', () => {
    const skills = [{ label: 'Light energy', correct: 3, total: 3 }, { label: 'Water', correct: 0, total: 2 }]
    expect(finishTip('quiz', skills, 1)).toBe('Next, let\'s practise "Water". A little more and it will stick!')
    expect(finishTip('quiz', [{ label: 'Light energy', correct: 3, total: 3 }], 3)).toBeNull()
  })

  it('says a day the way a person would', () => {
    expect(spoken(new Date(2026, 8, 30, 15, 0).toISOString(), now)).toMatch(/^today at 3:00/)
    expect(spoken(new Date(2026, 9, 3, 9, 0).toISOString(), now)).toMatch(/^on /)
  })
})

describe("home's own buddy", () => {
  it('adds what it knows beyond home: overdue work, the next lesson and how each kind has gone', () => {
    const lines = homeLines(brief({
      waiting: [{ title: 'Fractions', kind: 'quiz', due_at: null, overdue: true }],
      next_lesson: { id: 'l1', title: 'Plants', status: 'live', scheduled_at: null },
      kinds: [{ kind: 'quiz', average: 92, count: 3 }],
    }), now)
    expect(lines).toEqual([
      '"Fractions" is overdue. Shall we do it now? I\'ll help!',
      'Your live lesson "Plants" is on now! Head to Schedule to join.',
      'Your quizzes are going brilliantly lately: 92% on average!',
    ])
    expect(homeLines(null)).toEqual([])
  })
})
