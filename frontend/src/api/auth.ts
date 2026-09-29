import { request } from './client'
import type { AuthResponse, Credentials, User } from './types'

export const register = (credentials: Credentials): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/register', { method: 'POST', body: credentials })

export const login = (credentials: Credentials): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/login', { method: 'POST', body: credentials })

export const me = (signal?: AbortSignal): Promise<User> => request<User>('/auth/me', { signal })
