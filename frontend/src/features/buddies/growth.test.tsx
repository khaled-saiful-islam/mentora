import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { Buddy } from './Buddy'
import { BuddyPicker } from './BuddyPicker'
import { anticsFor, described, knows, learnedBetween, shrunk, stageFor, TAP_MOVE } from './growth'
import { GrowthBar } from './GrowthBar'

function wrap(children: React.ReactNode) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  return render(
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>,
  )
}

describe('a growing buddy (§28.3.1)', () => {
  it('reaches its stages at the same growth the server counts', () => {
    expect([0, 39, 40, 199, 200, 599, 600, 9999].map(stageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('learns its show-off moves as it grows, and its trick last', () => {
    expect(knows('giggle', 0)).toBe(true)
    expect(knows('dance', 0)).toBe(false)
    expect(knows('dance', 2)).toBe(true)
    expect(knows('trick', 2)).toBe(false)
    expect(knows('trick', 3)).toBe(true)
    expect(learnedBetween(1, 3)).toEqual(expect.arrayContaining(['dance', 'twirl', 'starjump', 'trick']))
    expect(learnedBetween(1, 3)).not.toContain('wave')
  })

  it('keeps every reaction that helps a child learn, at every stage', () => {
    for (const reaction of ['oops', 'cheer', 'point', 'shy', 'peek'] as const) expect(knows(reaction, 0)).toBe(true)
  })

  it('fidgets only with moves it knows, and like a baby when it knows none of its own', () => {
    expect(anticsFor(['hug', 'stretch', 'giggle'], 1)).toEqual(['hug', 'giggle'])
    expect(anticsFor(['dance', 'flex'], 0)).toEqual(['yawn', 'wiggle', 'nod', 'giggle'])
    expect(TAP_MOVE[0]).toBe('giggle')
  })

  it('is called what it is at each stage', () => {
    expect(described('ollie', 0)).toBe('a tiny owlet')
    expect(described('rimau', 2)).toBe('a young tiger')
    expect(described('momo', 3)).toBe('a grown-up orangutan')
  })

  it('starts its sparkles from where its smaller head really is', () => {
    expect(shrunk([100, 30], 3)).toEqual([100, 30])
    const [, y] = shrunk([100, 30], 0)
    expect(y).toBeGreaterThan(30)
  })

  it('says a baby is little, and does its best move when tapped', async () => {
    wrap(<Buddy buddy="ollie" stage={0} />)
    expect(screen.getByRole('button', { name: /Ollie, a tiny owlet\. Tap to play!/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('growth bar', () => {
  it('says how far to the next stage', () => {
    render(<GrowthBar buddy="momo" points={134} />)
    expect(screen.getByText('134 of 200 growth to Young')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Growth to Young' })).toHaveAttribute('aria-valuenow', '134')
  })

  it('fills to the brim when the buddy is about to grow up', () => {
    render(<GrowthBar buddy="momo" points={44} within={0} />)
    expect(screen.getByText('Ready to grow up!')).toBeInTheDocument()
  })

  it('says when there is no more growing to do', () => {
    render(<GrowthBar buddy="momo" points={650} />)
    expect(screen.getByText('Fully grown!')).toBeInTheDocument()
  })
})

describe('buddy friends', () => {
  it('shows a buddy still to meet as a mystery, and says how to meet it', async () => {
    const chosen = vi.fn()
    const asked = vi.fn()
    wrap(<BuddyPicker value="kiko" onChange={chosen} stage={1} locked={(key) => (key === 'rimau' ? '2 more badges' : null)} onLocked={asked} />)
    const rimau = screen.getByRole('radio', { name: 'Rimau, still to meet: 2 more badges' })
    expect(rimau).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(rimau)
    expect(chosen).not.toHaveBeenCalled()
    expect(asked).toHaveBeenCalledWith('rimau', '2 more badges')
    await userEvent.click(screen.getAllByRole('radio').find((r) => r.textContent?.includes('Momo')) as HTMLElement)
    expect(chosen).toHaveBeenCalledWith('momo')
  })
})
