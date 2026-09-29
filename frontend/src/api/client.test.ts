import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, setToken, setUnauthorizedHandler } from './client'
import { notesApi } from './index'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: Parameters<typeof fetch>) =>
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    setUnauthorizedHandler(null)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the bearer token and relative /api URL', async () => {
    setToken('abc')
    const fetchMock = mockFetch(200, [])
    await notesApi.listNotes('hello world')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notes?q=hello%20world')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('surfaces the server error message', async () => {
    mockFetch(409, { error: 'username taken' })
    await expect(request('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409,
      message: 'username taken',
    })
  })

  it('calls the unauthorized handler on 401 only when a token was sent', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockFetch(401, { error: 'bad creds' })
    await expect(request('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
    setToken('t')
    await expect(request('/notes')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for 204', async () => {
    mockFetch(204, null)
    await expect(notesApi.deleteNote(1)).resolves.toBeUndefined()
  })
})
