import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { openTour, Tour } from './Tour'

const TEACHER = {
  id: '9', username: null, email: 'cikgu@school.test', display_name: 'Cikgu Aisyah', role: 'teacher', is_admin: false,
  grade_level: null, grade_label: null, buddy: null,
  preferences: { text_scale: 100, font_style: 'classic', motion: 'reduce', sound: false },
  onboarded: false, toured: false,
  capabilities: { manage_classes: true, share_learning_sets: true },
  created_at: '2026-09-27T00:00:00Z',
}

vi.mock('@/motion', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/motion')>()), celebrate: vi.fn() }))

function serve(me: object) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method !== 'GET') calls.push(`${method} ${path}`)
    if (path === '/api/auth/me') return json(me)
    if (path === '/api/auth/me/toured') return json({ ...me, toured: true })
    return json({}, 404)
  }))
  return calls
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mount() {
  render(
    <AuthProvider>
      <PreferencesProvider>
        <Tour />
      </PreferencesProvider>
    </AuthProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('the first-visit tour', () => {
  it('opens by itself for someone new, steps through, and is remembered at the end', async () => {
    const calls = serve(TEACHER)
    mount()
    expect(await screen.findByRole('dialog', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome, Cikgu!' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByRole('heading', { name: 'Start a class' })).toBeInTheDocument()
    expect(screen.getByText('Classes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Cikgu!' })).toBeInTheDocument()
    for (let i = 0; i < 3; i++) await userEvent.click(await screen.findByRole('button', { name: /Next/ }))
    await userEvent.click(await screen.findByRole('button', { name: "Let's go!" }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls).toEqual(['POST /api/auth/me/toured'])
  })

  it('can be skipped or closed with Escape, and says so to the server once', async () => {
    const calls = serve(TEACHER)
    mount()
    await screen.findByRole('dialog', {}, { timeout: 2000 })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls).toEqual(['POST /api/auth/me/toured'])
  })

  it('stays away once seen, and opens again from Settings', async () => {
    const calls = serve({ ...TEACHER, toured: true })
    mount()
    await new Promise((r) => setTimeout(r, 900))
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => openTour())
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls).toEqual([])
  })

  it('waits for a new student to meet their buddy first', async () => {
    serve({ ...TEACHER, role: 'student', onboarded: false, capabilities: { take_assignments: true } })
    mount()
    await new Promise((r) => setTimeout(r, 900))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
