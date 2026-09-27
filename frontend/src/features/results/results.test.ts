import { describe, expect, it } from 'vitest'
import type { HistoryRow, SkillInsight } from '@/features/play/api'
import { summarise } from './ResultsView'

const row = (percent: number, i: number): HistoryRow => ({
  attempt_id: `a${i}`, title: `Set ${i}`, kind: 'quiz', purpose: 'assign', subject: 'Science',
  percent, score: 0, max_score: 10, completed_at: `2026-09-${String(27 - i).padStart(2, '0')}T08:00:00Z`, assignment_id: null,
})
const skill = (label: string, mastery: number, level: SkillInsight['level']): SkillInsight => ({ subject: 'Science', slug: label, label, correct: 1, total: 2, mastery, level })

describe('the results summary', () => {
  it('counts, averages the last five, adds up stars, and reads the trend', () => {
    // Newest first, as the server sends them: the last three beat the three before.
    const rows = [90, 80, 100, 40, 30, 50].map(row)
    const s = summarise(rows, [skill('Rain', 0.9, 'strong'), skill('Clouds', 0.2, 'practise'), skill('Wind', 0.4, 'practise')])
    expect([s.finished, s.usual, s.stars, s.trend]).toEqual([6, 68, 3 + 2 + 3 + 1 + 0 + 1, 'up'])
    expect([s.best?.label, s.next?.label]).toEqual(['Rain', 'Clouds'])
  })

  it('says a newcomer is just starting, and a dip gently', () => {
    expect(summarise([row(50, 0)], []).trend).toBe('new')
    expect(summarise([20, 30, 20, 90, 80, 90].map(row), []).trend).toBe('down')
  })
})
