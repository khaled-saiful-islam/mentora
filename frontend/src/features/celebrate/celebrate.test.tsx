import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { CelebrationProvider, isBusy, useCelebrate, type Celebration } from './CelebrationProvider'
import { Scene } from './Scene'

function moment(id: string, onClose = vi.fn()): Celebration {
  return {
    id,
    onClose,
    render: (close) => (
      <Scene title={`Moment ${id}`} colour="--buddy-momo" onClose={close} action="Yay!">
        <p>inside {id}</p>
      </Scene>
    ),
  }
}

let ask: (m: Celebration) => void = () => {}
let go: (to: string) => void = () => {}

function Hooks() {
  ask = useCelebrate()
  go = useNavigate()
  return null
}

function mount(at = '/') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(
    <AuthProvider>
      <PreferencesProvider>
        <MemoryRouter initialEntries={[at]}>
          <CelebrationProvider>
            <Routes>
              <Route path="*" element={<Hooks />} />
            </Routes>
          </CelebrationProvider>
        </MemoryRouter>
      </PreferencesProvider>
    </AuthProvider>,
  )
}

describe('celebrations (§28.4)', () => {
  it('knows when a child is in the middle of something', () => {
    expect(isBusy('/play/abc')).toBe(true)
    expect(isBusy('/practice/abc')).toBe(true)
    expect(isBusy('/library/abc/try')).toBe(true)
    expect(isBusy('/room/abc')).toBe(true)
    expect(isBusy('/practice')).toBe(false)
    expect(isBusy('/buddy')).toBe(false)
    expect(isBusy('/')).toBe(false)
  })

  it('plays one at a time, each once, and says when it is done', async () => {
    mount()
    const first = vi.fn()
    act(() => {
      ask(moment('a', first))
      ask(moment('a'))
      ask(moment('b'))
    })
    expect(screen.getByRole('dialog', { name: 'Moment a' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yay!' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Yay!' }))
    expect(first).toHaveBeenCalledOnce()
    expect(await screen.findByRole('dialog', { name: 'Moment b' })).toBeInTheDocument()
  })

  it('waits while a quiz is open and plays once the child is done', async () => {
    mount('/play/abc')
    act(() => ask(moment('grow')))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => go('/'))
    expect(await screen.findByRole('dialog', { name: 'Moment grow' })).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    mount()
    act(() => ask(moment('esc')))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Moment esc' })).not.toBeInTheDocument()
  })
})
