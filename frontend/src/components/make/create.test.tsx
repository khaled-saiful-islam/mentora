import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningKindInfo } from '@/features/learning/api'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { creatables } from './creatables'
import { CreateMenu } from './CreateMenu'
import { CreatePanel } from './CreatePanel'

const LEARNING: LearningKindInfo[] = [
  { name: 'quiz', label: 'Quiz', item_noun: 'question', item_noun_plural: 'questions', default_count: 10, max_count: 30, purpose: 'assign' },
  { name: 'study_guide', label: 'Study guide', item_noun: 'section', item_noun_plural: 'sections', default_count: 5, max_count: 8, purpose: 'assign' },
]
const STUDIO = [
  { name: 'poster', label: 'Poster', description: 'A poster.' },
  { name: 'slides', label: 'Slides', description: 'A deck.' },
]
const ITEMS = creatables(STUDIO, LEARNING)

function wrapped(node: React.ReactNode) {
  return render(
    <AuthProvider>
      <PreferencesProvider>{node}</PreferencesProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
})

describe('creatables', () => {
  it('lists the learning kinds first, then the studio, each with a short line', () => {
    expect(ITEMS.map((i) => [i.group, i.key])).toEqual([
      ['learning', 'quiz'], ['learning', 'study_guide'], ['studio', 'poster'], ['studio', 'slides'],
    ])
    for (const item of ITEMS) expect(item.blurb.length).toBeLessThanOrEqual(40)
    expect(ITEMS.find((i) => i.key === 'poster')?.makeable?.name).toBe('poster')
  })
})

describe('CreatePanel', () => {
  it('shows one group at a time and switches with its tabs', async () => {
    wrapped(<CreatePanel items={ITEMS} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /^Quiz:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Poster:/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Studio/ }))
    expect(await screen.findByRole('button', { name: /^Poster:/ })).toBeInTheDocument()
  })

  it('starts the one picked with its example', async () => {
    const onPick = vi.fn()
    wrapped(<CreatePanel items={ITEMS} onPick={onPick} />)
    await userEvent.click(screen.getByRole('button', { name: /^Study guide:/ }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'study_guide' }), 'The water cycle')
  })

  it('has no tabs when there is only one group', () => {
    wrapped(<CreatePanel items={creatables([], LEARNING)} onPick={() => {}} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('CreateMenu', () => {
  it('opens a grouped menu and closes on picking', async () => {
    const onPick = vi.fn()
    wrapped(<CreateMenu items={ITEMS} onPick={onPick} />)
    await userEvent.click(screen.getByRole('button', { name: /Create/ }))
    expect(screen.getByText('Learning')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: /Poster/ }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'poster' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    wrapped(<CreateMenu items={ITEMS} onPick={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Create/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
