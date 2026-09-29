import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, getToken, setToken, setUnauthorizedHandler, type Credentials, type User } from '../api'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // Any 401 on an authenticated call logs the user out (routes then redirect to /login).
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Validate a stored token on load.
  useEffect(() => {
    if (getToken() === null) return
    const controller = new AbortController()
    authApi
      .me(controller.signal)
      .then((u) => setUser(u))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Invalid token (401 already handled) or server unreachable: treat as signed out.
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const login = useCallback(async (credentials: Credentials) => {
    const res = await authApi.login(credentials)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const register = useCallback(async (credentials: Credentials) => {
    const res = await authApi.register(credentials)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
