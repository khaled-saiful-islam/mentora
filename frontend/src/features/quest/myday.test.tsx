import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { CelebrationProvider } from '@/features/celebrate/CelebrationProvider'
import type { MyDay as Day } from './api'
import { MyDay } from './MyDay'
import { QuestDone } from './QuestDone'

const DAY: Day = {
  day: '2026-10-14',
  quest: { set_id: 'q1', day: '2026-10-14', questions: 5, review: 2, fresh: 3, done: false },
  streak: { days: 8, freezes: 1, today_done: true },
  garden: [
    { skill: 'light', label: 'Light energy', box: 0, mastery: 0.25, thirsty: true, due_on: '2026-10-14' },
    { skill: 'water', label: 'Water', box: 5, mastery: 1, thirsty: false, due_on: '2026-11-10' },
  ],
  classes: [{ class_id: 'c1', name: '5 Bestari', theme: 'grape', done: 12, goal: 30, week: '2026-10-12', buddies: ['momo', 'kiko'] }],
}

function serve(day: Day) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('/me/day') ? new Response(JSON.stringify(day), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 401 }),
    ),
  )
}

function mount(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <CelebrationProvider>{children}</CelebrationProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('my day (§28.3.4)', () => {
  it('offers today\'s quest, review first, with the streak and its freezes', async () => {
    serve(DAY)
    mount(<MyDay />)
    expect(await screen.findByRole('heading', { name: '5 quick questions' })).toBeInTheDocument()
    expect(screen.getByText(/2 to water in your garden and 3 new/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start the quest/ })).toHaveAttribute('href', '/practice/q1')
    expect(screen.getByLabelText('8-day streak, 1 freeze held')).toBeInTheDocument()
  })

  it('shows the garden, a thirsty plant asking for water', async () => {
    serve(DAY)
    mount(<MyDay />)
    expect(await screen.findByLabelText('Light energy: 25% right, needs water')).toBeInTheDocument()
    expect(screen.getByLabelText('Water: 100% right')).toBeInTheDocument()
    expect(screen.getByText(/1 plant needs water/)).toBeInTheDocument()
  })

  it('says when the quest is done, or not made yet', async () => {
    serve({ ...DAY, quest: { ...DAY.quest!, done: true } })
    const { unmount } = mount(<MyDay />)
    expect(await screen.findByRole('heading', { name: 'Done for today!' })).toBeInTheDocument()
    unmount()
    serve({ ...DAY, quest: null })
    mount(<MyDay />)
    expect(await screen.findByRole('heading', { name: 'Your first quest is on its way' })).toBeInTheDocument()
  })

  it('counts the class quest together, and throws one party when it is reached', async () => {
    serve(DAY)
    const { unmount } = mount(<MyDay />)
    expect(await screen.findByRole('progressbar', { name: 'Class quests this week' })).toHaveAttribute('aria-valuenow', '12')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    serve({ ...DAY, classes: [{ ...DAY.classes[0], done: 30 }] })
    mount(<MyDay />)
    expect(await screen.findByRole('dialog', { name: 'Class quest complete!' })).toBeInTheDocument()
  })
})

describe('the finish of a quest', () => {
  it('says the quest is complete with the streak, only for a quest', async () => {
    serve(DAY)
    const { unmount } = mount(<QuestDone title="Today's Quest" />)
    expect(await screen.findByRole('status')).toHaveTextContent('Quest complete! 8-day streak')
    unmount()
    mount(<QuestDone title="Fractions" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
