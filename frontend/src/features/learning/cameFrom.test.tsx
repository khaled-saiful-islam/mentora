/**
 * Back to where a set was opened from: the chat, when its card opened it —
 * remembered for the set — else the Library.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { fromChat, useBackFor } from './cameFrom'

afterEach(() => window.sessionStorage.clear())

function Back({ setId }: { setId: string }) {
  const back = useBackFor(setId)
  return <a href={back.to}>{back.label}</a>
}

function at(path: string, state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/library/:id" element={<Back setId="s1" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('back from a set', () => {
  it('goes to the Library by default', () => {
    at('/library/s1')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library')
  })

  it('goes back to the chat that opened it, and remembers it for the set', () => {
    at('/library/s1', fromChat('s1', '/c/abc'))
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/c/abc')
  })

  it('remembers the chat after a step away, such as playing it', () => {
    fromChat('s1', '/c/abc')
    at('/library/s1')
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/c/abc')
  })

  it('never leads anywhere but a page of the app', () => {
    at('/library/s1', { back: { to: 'https://evil.example', label: 'Chat' } })
    expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument()
  })
})
