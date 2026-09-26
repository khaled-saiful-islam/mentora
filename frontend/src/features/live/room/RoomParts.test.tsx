import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { HandControl } from './RoomParts'

function hand(props: Partial<Parameters<typeof HandControl>[0]>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  const all = {
    mine: 'none' as const,
    left: 3,
    position: 0,
    mode: 'anytime' as const,
    calledName: null,
    onRaise: vi.fn(),
    onLower: vi.fn(),
    onAsk: vi.fn(),
    onAskAloud: vi.fn().mockResolvedValue(undefined),
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

describe('the hand', () => {
  it('goes up, and says how many questions are left', async () => {
    const got = hand({})
    await userEvent.click(screen.getByRole('button', { name: /raise my hand/i }))
    expect(got.onRaise).toHaveBeenCalled()
    expect(screen.getByText('3 questions left')).toBeInTheDocument()
  })

  it('cannot go up once the questions are used', () => {
    hand({ left: 0 })
    expect(screen.getByRole('button', { name: /no questions left/i })).toBeDisabled()
  })

  it("says the student's place in line, and can come down", async () => {
    const got = hand({ mine: 'up', position: 2 })
    expect(screen.getByText(/You're 2nd in line/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /put my hand down/i }))
    expect(got.onLower).toHaveBeenCalled()
  })

  it('when called on, offers holding to talk or typing', async () => {
    const got = hand({ mine: 'called' })
    expect(screen.getByRole('button', { name: 'Hold to talk' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Type your question'), 'Why are leaves green?')
    await userEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(got.onAsk).toHaveBeenCalledWith('Why are leaves green?')
  })
})
