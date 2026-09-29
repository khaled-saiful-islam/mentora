import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { actionOf, headlineOf, kindOf } from '@/features/notifications/kinds'
import { navFor } from '@/features/shell/nav'
import type { User } from '@/lib/user'
import { MAX_BODY, whoLine, type Message, type Thread } from './api'
import { Composer } from './Composer'
import { previewOf } from './MessagesPage'
import { ThreadView, dayLabel, merge, startersFor } from './ThreadView'

afterEach(() => vi.unstubAllGlobals())

const contact = {
  student_id: 's1',
  student_name: 'Aina Sofea',
  person_id: 't1',
  person_name: 'Cikgu Demo',
  relation: 'Teacher',
  class_ids: ['c1'],
  class_names: ['4 Cerdik'],
}

function message(id: string, body: string, mine: boolean, at: string): Message {
  return { id, thread_id: 'th1', body, mine, created_at: at }
}

function thread(over: Partial<Thread> = {}): Thread {
  return { id: 'th1', side: 'parent', contact, unread: 0, last: null, last_message_at: null, ...over }
}

describe('the words around a conversation', () => {
  it('says who a parent is writing to, and who a teacher is', () => {
    expect(whoLine(thread())).toBe('Teacher · 4 Cerdik')
    const teacherSide = thread({ side: 'teacher', contact: { ...contact, person_name: 'Nora', relation: 'Mum' } })
    expect(whoLine(teacherSide)).toBe('Mum · about Aina Sofea')
  })

  it('shows a short last message whole and never cuts a long one', () => {
    const short = message('m1', 'See you at pickup!', true, '2026-09-29T08:00:00Z')
    expect(previewOf(thread({ last: short }))).toBe('You: See you at pickup!')
    const long = message('m2', 'word '.repeat(40), false, '2026-09-29T08:00:00Z')
    expect(previewOf(thread({ last: long }))).toBe('Cikgu Demo sent a longer message')
    expect(previewOf(thread())).toBe('No messages yet')
  })

  it('offers each side its own way to start', () => {
    expect(startersFor(thread())[0]).toBe('How is Aina getting on in class?')
    expect(startersFor(thread({ side: 'teacher' }))[0]).toBe('Aina did really well this week!')
  })

  it('names the day of each run of messages', () => {
    const now = new Date('2026-09-29T12:00:00')
    expect(dayLabel('2026-09-29T09:00:00', now)).toBe('Today')
    expect(dayLabel('2026-09-28T09:00:00', now)).toBe('Yesterday')
  })

  it('merges a fresh page into what is shown, once each, oldest first', () => {
    const a = message('a', 'one', true, '2026-09-29T08:00:00Z')
    const b = message('b', 'two', false, '2026-09-29T08:01:00Z')
    const c = message('c', 'three', true, '2026-09-29T08:02:00Z')
    expect(merge([a, c], [b, c]).map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('rings the bell with who wrote, about which child, and opens the thread', () => {
    const note = {
      id: 'n1',
      type: 'parent_teacher_message',
      payload: { thread_id: 'th1', from_name: 'Nora', from_side: 'parent', student_name: 'Aina' },
      count: 1,
      read: false,
      created_at: '2026-09-29T08:00:00Z',
      updated_at: '2026-09-29T08:00:00Z',
    }
    expect(headlineOf(note)).toMatch(/Nora/)
    expect(kindOf(note).href?.(note)).toBe('/messages/th1')
    expect(actionOf(note)).toBe('Reply')
    expect(kindOf({ ...note, count: 3 }).title({ ...note, count: 3 })).toBe('3 new messages from Nora about Aina')
  })
})

describe('where messages live', () => {
  const user = (role: User['role'], caps: Partial<User['capabilities']>) => ({ role, capabilities: caps }) as unknown as User

  it('is in a parent and a teacher sidebar, never a student', () => {
    expect(navFor(user('parent', { parent_teacher_messages: true, see_children: true })).map((i) => i.key)).toContain('messages')
    expect(navFor(user('teacher', { parent_teacher_messages: true, manage_classes: true })).map((i) => i.key)).toContain('messages')
    expect(navFor(user('student', { take_assignments: true })).map((i) => i.key)).not.toContain('messages')
  })

  it("stays out of the phone's tab bar, where the header's envelope is", () => {
    const item = navFor(user('parent', { parent_teacher_messages: true })).find((i) => i.key === 'messages')
    expect(item?.tab).toBe(false)
  })
})

describe('writing a message', () => {
  it('sends on Enter, keeps a new line on Shift+Enter, and clears once sent', async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    render(<Composer onSend={onSend} placeholder="Write to Cikgu Demo…" />)
    const box = screen.getByLabelText('Your message')
    await userEvent.type(box, 'Hello{Shift>}{Enter}{/Shift}there')
    expect(onSend).not.toHaveBeenCalled()
    await userEvent.type(box, '{Enter}')
    expect(onSend).toHaveBeenCalledWith('Hello\nthere')
    await waitFor(() => expect(box).toHaveValue(''))
  })

  it('keeps the words when sending fails', async () => {
    const onSend = vi.fn().mockResolvedValue(false)
    render(<Composer onSend={onSend} placeholder="Write…" />)
    const box = screen.getByLabelText('Your message')
    await userEvent.type(box, 'Hello{Enter}')
    await waitFor(() => expect(onSend).toHaveBeenCalled())
    expect(box).toHaveValue('Hello')
  })

  it('fills the box from a suggestion, and says when a message is too long', async () => {
    render(<Composer onSend={vi.fn()} placeholder="Write…" suggestions={['How is Aina getting on in class?']} />)
    await userEvent.click(screen.getByRole('button', { name: 'How is Aina getting on in class?' }))
    expect(screen.getByLabelText('Your message')).toHaveValue('How is Aina getting on in class?')
    render(<Composer onSend={vi.fn()} placeholder="Write…" initial={'x'.repeat(MAX_BODY + 5)} />)
    expect(screen.getByText('5 characters too long')).toBeInTheDocument()
  })
})

describe('a conversation', () => {
  it('shows the messages, sends a reply, and marks the thread read', async () => {
    const sent: string[] = []
    const reads: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
        const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
        if (path === '/api/messages/threads/th1') return ok(thread())
        if (path === '/api/messages/threads/th1/read') {
          reads.push(path)
          return ok({ unread: 0 })
        }
        if (path === '/api/messages/threads/th1/messages' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { body: string }
          sent.push(body.body)
          return ok(message('m9', body.body, true, '2026-09-29T09:00:00Z'))
        }
        if (path === '/api/messages/threads/th1/messages') {
          return ok({ items: [message('m1', 'Aina did well on fractions today.', false, '2026-09-29T08:00:00Z')], has_more: false })
        }
        return ok({})
      }),
    )
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/messages/th1']}>
          <Routes>
            <Route path="/messages/:threadId" element={<ThreadView threadId="th1" onBack={() => undefined} />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )
    expect(await screen.findByText('Aina did well on fractions today.')).toBeInTheDocument()
    expect(screen.getByText('Cikgu Demo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Aina's results/ })).toHaveAttribute('href', '/children/s1/results')
    await waitFor(() => expect(reads.length).toBeGreaterThan(0))
    await userEvent.type(screen.getByLabelText('Your message'), 'Thank you!{Enter}')
    expect(await screen.findByText('Thank you!')).toBeInTheDocument()
    expect(sent).toEqual(['Thank you!'])
  })
})
