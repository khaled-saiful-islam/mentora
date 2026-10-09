/**
 * How to play (§26.8): every template has its three steps and an animated
 * demo, in the game's language; calm holds the demo still with every step lit.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Play } from '../types'
import { HOW_TO, HowToFolded, HowToPlay } from '.'

const PLAYS = Object.keys(HOW_TO) as Play[]

describe('how to play', () => {
  it.each(PLAYS)('shows the three steps of %s, with a picture of the move', (play) => {
    const { container } = render(<HowToPlay play={play} language="en" calm />)
    const section = screen.getByRole('region', { name: 'How to play' })
    expect(within(section).getAllByRole('listitem')).toHaveLength(3)
    expect(section).toHaveTextContent(HOW_TO[play].en[1])
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('speaks Malay in a Malay game', () => {
    render(<HowToPlay play="sort" language="ms" calm />)
    expect(screen.getByRole('region', { name: 'Cara bermain' })).toHaveTextContent('Ketik bakul yang betul')
  })

  it('is folded away until asked for after its first island', async () => {
    render(<HowToFolded play="lab" language="en" calm />)
    expect(screen.queryByRole('region', { name: 'How to play' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /How to play/ }))
    expect(screen.getByRole('region', { name: 'How to play' })).toHaveTextContent('green zone')
  })
})
