import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { LearningKindInfo } from './api'
import { LearnTiles } from './LearnTiles'

const KINDS: LearningKindInfo[] = [
  { name: 'quiz', label: 'Quiz', item_noun: 'question', item_noun_plural: 'questions', default_count: 10, max_count: 30, purpose: 'assign' },
  { name: 'flashcard', label: 'Flashcards', item_noun: 'card', item_noun_plural: 'cards', default_count: 10, max_count: 40, purpose: 'assign' },
]

function mount(onPick: (kind: string) => void, kinds = KINDS) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(
    <AuthProvider>
      <PreferencesProvider>
        <LearnTiles kinds={kinds} onPick={onPick} />
      </PreferencesProvider>
    </AuthProvider>,
  )
}

describe('LearnTiles', () => {
  it('offers each kind and opens the one tapped', async () => {
    const onPick = vi.fn()
    mount(onPick)
    await userEvent.click(screen.getByRole('button', { name: /^Flashcards:/ }))
    expect(onPick).toHaveBeenCalledWith('flashcard')
    expect(screen.getByText('Make something to learn')).toBeInTheDocument()
  })

  it('says practise to a student', () => {
    mount(() => {}, KINDS.map((k) => ({ ...k, purpose: 'practice' as const })))
    expect(screen.getByText('Practise any topic')).toBeInTheDocument()
  })

  it('shows nothing when nothing can be made', () => {
    const { container } = render(<LearnTiles kinds={[]} onPick={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
