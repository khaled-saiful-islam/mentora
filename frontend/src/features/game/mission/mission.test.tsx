import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { spokenId } from '@/features/play/usePlayVoice'
import { missionLines } from '../overlay'
import { AcceptMission } from './Accept'
import { MissionBriefing } from './Briefing'
import { NarrationContext, Said } from './narration'
import { LEVEL } from './score'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function wrap(children: React.ReactNode) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  return render(
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>,
  )
}

describe('a mission told aloud (§28.3.2)', () => {
  it('lights up each word of the line being said, as it is said', async () => {
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const now = { id: 'story:hook:', text: 'The river is drying up!', start: 0, duration: 2500 }
    const { container } = render(
      <NarrationContext.Provider value={now}>
        <p>
          <Said text="The river is drying up!" />
        </p>
        <p>
          <Said text="Another line." />
        </p>
      </NarrationContext.Provider>,
    )
    clock = 1300
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 60)))
    const words = [...container.querySelectorAll('p:first-child span span')]
    expect(words.map((w) => w.textContent)).toEqual(['The', 'river', 'is', 'drying', 'up!'])
    const current = words.findIndex((w) => w.className.includes('bg-star-soft'))
    expect(current).toBeGreaterThan(0)
    expect(words[words.length - 1].className).toContain('opacity-60')
    // Lines not being said are just their words.
    expect(container.querySelectorAll('p:last-child span')).toHaveLength(0)
  })

  it('shows a line plainly when nothing is being said', () => {
    render(<Said text="Quiet now." />)
    expect(screen.getByText('Quiet now.')).toBeInTheDocument()
  })

  it('names every spoken line the same way wherever it is used', () => {
    expect(spokenId({ item: 'opening', part: 'story', n: 2 })).toBe('story:opening:2')
    expect(spokenId({ item: 'i1', part: 'learn' })).toBe('learn:i1:')
  })

  it('keeps the music well under the voice, and quieter still while it speaks', () => {
    expect(LEVEL.music).toBeLessThan(0.1)
    expect(LEVEL.ducked).toBeLessThan(LEVEL.music)
    expect(LEVEL.sting).toBeLessThan(0.2)
  })
})

describe('the mission briefing', () => {
  it('names the mission, the agent and the islands, and starts on one tap', async () => {
    const begin = vi.fn()
    wrap(<MissionBriefing title="Save the River" count={4} agent="Aina" world="rainforest" calm onBegin={begin} />)
    const briefing = screen.getByRole('dialog', { name: 'Mission briefing: Save the River' })
    expect(briefing).toHaveTextContent('Incoming mission')
    expect(briefing).toHaveTextContent('For Agent Aina')
    expect(briefing).toHaveTextContent('4 islands to explore')
    await userEvent.click(screen.getByRole('button', { name: 'Start the mission' }))
    expect(begin).toHaveBeenCalledOnce()
  })
})

describe('accepting the mission', () => {
  it('stamps it accepted, then starts the game, once', async () => {
    const start = vi.fn()
    wrap(<AcceptMission onStart={start} />)
    const button = screen.getByRole('button', { name: 'Accept the mission' })
    await userEvent.click(button)
    expect(screen.getByRole('status')).toHaveTextContent('Mission accepted!')
    expect(button).toBeDisabled()
    await waitFor(() => expect(start).toHaveBeenCalledOnce(), { timeout: 2500 })
  })
})

describe('mission control (§28.3.2)', () => {
  it('calls the agent, hands over the mission and wishes luck, in the game\'s language', () => {
    const en = missionLines('en', 4)
    expect(en.map((l) => l.text)).toEqual(['Attention, agent. A new mission is coming in.', 'Here is your mission.', '4 islands stand in your way. Good luck, agent.'])
    expect(en[2].spoken).toEqual({ item: 'mission', part: 'story', n: 2 })
    expect(missionLines('ms', 3)[2].text).toBe('3 pulau menanti anda. Semoga berjaya, ejen.')
  })
})
