import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { Buddy, type BuddyHandle } from './Buddy'
import { VOICES } from './voices'

function mount(props: Partial<React.ComponentProps<typeof Buddy>> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  const ref = createRef<BuddyHandle>()
  render(
    <AuthProvider>
      <PreferencesProvider>
        <Buddy ref={ref} buddy="ollie" {...props} />
      </PreferencesProvider>
    </AuthProvider>,
  )
  return ref
}

describe('Buddy', () => {
  it('is named for screen readers, and invites a tap', () => {
    mount()
    expect(screen.getByRole('img', { name: 'Ollie the owl' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tap for a flutter/ })).toBeInTheDocument()
  })

  it('says something in its own voice when tapped', async () => {
    mount()
    await userEvent.click(screen.getByRole('button'))
    const said = screen.getByRole('status').textContent?.replace(/ /g, ' ')
    expect(VOICES.ollie.tap).toContain(said)
  })

  it('speaks when a game cues it, and goes quiet after', async () => {
    const ref = mount({ interactive: false })
    act(() => ref.current?.say('Well done!', 60))
    expect(screen.getByRole('status')).toHaveTextContent('Well done!')
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('falls back to Kiko for a buddy it does not know', () => {
    mount({ buddy: 'dinosaur', interactive: false })
    expect(screen.getByRole('img', { name: 'Kiko the kancil' })).toBeInTheDocument()
  })
})
