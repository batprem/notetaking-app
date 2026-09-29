import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth/useAuth'
import { validateCredentials, type Mode } from '../auth/validate'

export function AuthPage({ mode }: { mode: Mode }) {
  const { login, register } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isLogin = mode === 'login'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validateCredentials(mode, username, password)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const creds = { username: username.trim(), password }
      await (isLogin ? login(creds) : register(creds))
      // Route guards redirect once the user is set.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Invalid username or password.')
        else if (err.status === 409) setError('That username is already taken.')
        else setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{isLogin ? 'Sign in to see your notes.' : 'Start capturing your thoughts.'}</p>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={error !== null}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error !== null}
          required
        />
        {!isLogin && <p className="hint">At least 3 characters for username, 8 for password.</p>}

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </button>

        <p className="switch">
          {isLogin ? (
            <>
              No account? <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              Already registered? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </form>
    </main>
  )
}
