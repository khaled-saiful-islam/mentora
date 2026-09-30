import { describe, expect, it } from 'vitest'
import type { WorkItem } from '@/features/work/api'
import type { SessionSummary } from './api'
import { cardState } from './cardState'
import { sinceLabel } from './when'

const now = new Date(2026, 8, 30, 10, 0)

function lesson(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'l1', title: 'The water cycle', status: 'scheduled', failure: null, class_id: 'c1', class_name: '4 Cerdik',
    group_id: null, group_name: 'Whole class', students: 20, parts: 4, subject: 'Science', grade_level: 'year_4',
    duration_minutes: 15, scheduled_at: null, flagged: false, started_at: null, ended_at: null, teacher_name: null,
    created_at: now.toISOString(), ...over,
  }
}

const writing: WorkItem = {
  id: 'l1', kind: 'live_plan', title: 'The water cycle', link: '/live/l1', state: 'running', progress: 0.5,
  label: 'Wrote part 2 of 4', message: null, started_at: now.toISOString(), finished_at: null,
}

describe('what a live lesson card says', () => {
  it('shows how far Astra is while she writes it', () => {
    const state = cardState(lesson({ status: 'planning' }), writing, now, 'teacher')
    expect(state).toMatchObject({ tone: 'busy', badge: 'Astra is writing it', detail: 'Wrote part 2 of 4', progress: 0.5 })
  })

  it('still says it is being written before the first word of progress arrives', () => {
    expect(cardState(lesson({ status: 'recording' }), undefined, now, 'teacher')).toMatchObject({ tone: 'busy', progress: null })
  })

  it('tells the teacher when it is waiting on them', () => {
    expect(cardState(lesson({ status: 'planned' }), undefined, now, 'teacher')).toMatchObject({
      tone: 'needs-you',
      detail: '4 parts written. Read them, then approve.',
      action: 'Check the lesson',
    })
    expect(cardState(lesson({ status: 'approved' }), undefined, now, 'teacher').action).toBe('Schedule it')
  })

  it('makes the class happening now stand out, with how long it has run', () => {
    const started = new Date(now.getTime() - 12 * 60000).toISOString()
    expect(cardState(lesson({ status: 'live', started_at: started }), undefined, now, 'teacher')).toMatchObject({
      tone: 'live',
      detail: 'Astra is teaching · began 12 minutes ago',
      action: 'Go to the room',
    })
  })

  it('says what went wrong', () => {
    expect(cardState(lesson({ status: 'failed', failure: 'No sources found.' }), undefined, now, 'teacher')).toMatchObject({ tone: 'problem', detail: 'No sources found.' })
  })

  it('asks a student to join once the room opens', () => {
    const soon = new Date(now.getTime() + 5 * 60000).toISOString()
    expect(cardState(lesson({ scheduled_at: soon }), undefined, now, 'student')).toMatchObject({ tone: 'open', action: 'Join now', detail: 'Starts in 5 minutes' })
  })
})

describe('how long ago something began', () => {
  it('says it the way a person would', () => {
    expect(sinceLabel(now.toISOString(), now)).toBe('just now')
    expect(sinceLabel(new Date(now.getTime() - 60000).toISOString(), now)).toBe('1 minute ago')
    expect(sinceLabel(new Date(now.getTime() - 125 * 60000).toISOString(), now)).toBe('2 hours ago')
  })
})
