import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { HandControl } from './RoomParts'

function hand(props: Partial<Parameters<typeof HandControl>[0]>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  // jsdom has no microphone: pretend there is one, so the mic button shows.
  vi.stubGlobal('MediaRecorder', class {})
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
  const all = {
    mine: 'none' as const,
    left: 3,
    position: 0,
    mode: 'anytime' as const,
    calledName: null,
    myQuestion: null,
    onSend: vi.fn(),
    onLower: vi.fn(),
    onAsk: vi.fn(),
    ...props,
  }
  render(
    <AuthProvider>
      <PreferencesProvider>
        <HandControl {...all} />
      </PreferencesProvider>
    </AuthProvider>,
  )
  return all
}

describe('asking Astra during the lesson', () => {
  it('sends a question — typed or said — straight into the queue', async () => {
    const got = hand({})
    expect(screen.getByRole('button', { name: 'Say it instead of typing' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Your question'), 'Why are leaves green?')
    expect(screen.getByLabelText('Your question')).toHaveValue('Why are leaves green?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(got.onSend).toHaveBeenCalledWith('Why are leaves green?')
    expect(screen.getByText(/3 questions left/)).toBeInTheDocument()
  })

  it('says when the questions are used up', () => {
    hand({ left: 0 })
    expect(screen.getByText(/asked all your questions/)).toBeInTheDocument()
  })

  it("shows the question in line, the student's place, and can take it back", async () => {
    const got = hand({ mine: 'up', position: 2, myQuestion: 'Do plants sleep?' })
    expect(screen.getByText(/You're 2nd in line/)).toBeInTheDocument()
    expect(screen.getByText('“Do plants sleep?”')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /take it back/i }))
    expect(got.onLower).toHaveBeenCalled()
  })

  it('shows the question being answered', () => {
    hand({ mine: 'asked', myQuestion: 'Do plants sleep?' })
    expect(screen.getByText(/Astra is answering your question/)).toBeInTheDocument()
  })
})
