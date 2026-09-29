import { afterEach, describe, expect, it, vi } from 'vitest'
import { announceSession, isSomeoneElse, onSessionChange } from './sessionSync'

const stops: (() => void)[] = []
afterEach(() => stops.splice(0).forEach((stop) => stop()))

describe('one browser, one session, every tab told', () => {
  it('starts a tab over only when the account is someone else', () => {
    expect(isSomeoneElse('teacher-1', 'parent-1')).toBe(true)
    expect(isSomeoneElse('teacher-1', null)).toBe(true)
    expect(isSomeoneElse(null, 'teacher-1')).toBe(true)
    expect(isSomeoneElse('teacher-1', 'teacher-1')).toBe(false)
  })

  it.runIf(typeof BroadcastChannel !== 'undefined')('hears another tab sign in, and not its own', async () => {
    const heard = vi.fn()
    stops.push(onSessionChange(heard))
    announceSession('me-again')
    const other = new BroadcastChannel('mentora-session')
    other.postMessage({ userId: 'parent-1', from: 'another-tab' })
    other.close()
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith('parent-1'))
    expect(heard).not.toHaveBeenCalledWith('me-again')
  })

  it('hears a sign-out through storage where there is no channel', () => {
    const heard = vi.fn()
    stops.push(onSessionChange(heard))
    window.dispatchEvent(new StorageEvent('storage', { key: 'mentora.session', newValue: JSON.stringify({ userId: null, from: 'another-tab' }) }))
    expect(heard).toHaveBeenCalledWith(null)
  })
})
