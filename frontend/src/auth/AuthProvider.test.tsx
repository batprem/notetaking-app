import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToken, setToken } from '../api'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function Probe() {
  const { user, loading } = useAuth()
  return <p>{loading ? 'loading' : (user?.username ?? 'anonymous')}</p>
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

describe('AuthProvider', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('restores the user from a valid stored token', async () => {
    setToken('good')
    stubFetch(200, { id: 1, username: 'alice' })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('loading')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('alice')).toBeTruthy())
  })

  it('clears an invalid token on 401', async () => {
    setToken('bad')
    stubFetch(401, { error: 'unauthorized' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('anonymous')).toBeTruthy())
    expect(getToken()).toBeNull()
  })
})
