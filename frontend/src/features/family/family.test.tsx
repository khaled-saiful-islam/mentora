import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { actionOf, headlineOf, kindOf } from '@/features/notifications/kinds'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import FamilyInvitePage from './FamilyInvitePage'
import { LabelPicker } from './LabelPicker'

afterEach(() => vi.unstubAllGlobals())

describe('a parent connecting', () => {
  it('tells the child who is following along, and where to see it', () => {
    const note = {
      id: 'f1',
      type: 'family_linked',
      payload: { parent_name: 'Siti', label: 'Mum' },
      count: 1,
      read: false,
      created_at: '2026-09-26T08:00:00Z',
      updated_at: '2026-09-26T08:00:00Z',
    }
    expect(headlineOf(note)).toMatch(/Mum|Siti/)
    expect(kindOf(note).href?.(note)).toBe('/settings')
    expect(actionOf(note)).toBe('My family')
  })

  it('lets a parent say who they are, in their own words if they like', async () => {
    function Harness() {
      const [label, setLabel] = useState('Mum')
      return (
        <>
          <LabelPicker value={label} onChange={setLabel} childName="Aina" />
          <output>{label}</output>
        </>
      )
    }
    render(<Harness />)
    expect(screen.getByText('What does Aina call you?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Dad' }))
    expect(screen.getByRole('status')).toHaveTextContent('Dad')
    await userEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    await userEvent.type(screen.getByLabelText('What they call you'), 'Nenek')
    expect(screen.getByRole('status')).toHaveTextContent('Nenek')
  })

  it('shows a signed-out parent the child, and the way in through the invitation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return new Response('{}', { status: 401 })
        if (path === '/api/family/invites/ABC234') return new Response(JSON.stringify({ first_name: 'Aina', buddy: 'kiko' }), { status: 200 })
        return new Response('{}', { status: 200 })
      }),
    )
    render(
      <MemoryRouter initialEntries={['/family/ABC234']}>
        <AuthProvider>
          <PreferencesProvider>
            <Routes>
              <Route path="/family/:key" element={<FamilyInvitePage />} />
            </Routes>
          </PreferencesProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Aina would like you to follow along with their learning on Mentora.')).toBeInTheDocument()
    const newParent = screen.getByRole('link', { name: /Make my parent account/ })
    expect(newParent).toHaveAttribute('href', '/signup/parent?invite=ABC234')
  })
})
