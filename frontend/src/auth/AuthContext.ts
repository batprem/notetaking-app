import { createContext } from 'react'
import type { Credentials, User } from '../api'

export interface AuthContextValue {
  user: User | null
  /** True while the stored token is being validated on load. */
  loading: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (credentials: Credentials) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
