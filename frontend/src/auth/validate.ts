export type Mode = 'login' | 'register'

export function validateCredentials(mode: Mode, username: string, password: string): string | null {
  if (mode === 'register') {
    if (username.trim().length < 3) return 'Username must be at least 3 characters.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
  } else if (!username.trim() || !password) {
    return 'Enter your username and password.'
  }
  return null
}
