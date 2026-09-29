import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, notesApi, type Note } from '../api'
import { useAuth } from '../auth/useAuth'
import { NoteEditor } from '../components/NoteEditor'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong.'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function NotesPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const selectedId = params.id !== undefined && /^\d+$/.test(params.id) ? Number(params.id) : null

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [selected, setSelected] = useState<Note | null>(null)
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  // Load / search the list.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    notesApi
      .listNotes(debouncedQuery, controller.signal)
      .then((data) => {
        setNotes(data)
        setListError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setListError(errMsg(err))
        setLoading(false)
      })
    return () => controller.abort()
  }, [debouncedQuery, reloadKey])

  // Load the selected note (full content) by id.
  useEffect(() => {
    if (selectedId === null) {
      setSelected(null)
      setNoteError(null)
      return
    }
    const controller = new AbortController()
    setNoteLoading(true)
    setNoteError(null)
    notesApi
      .getNote(selectedId, controller.signal)
      .then((n) => {
        setSelected(n)
        setNoteLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setSelected(null)
        setNoteError(err instanceof ApiError && err.status === 404 ? 'Note not found.' : errMsg(err))
        setNoteLoading(false)
      })
    return () => controller.abort()
  }, [selectedId])

  const handleSaved = useCallback((saved: Note) => {
    setNotes((prev) => {
      const rest = prev.filter((n) => n.id !== saved.id)
      // Keep the list sorted by updated_at desc; only re-add if it was in the (filtered) list.
      return prev.some((n) => n.id === saved.id) ? [saved, ...rest] : prev
    })
  }, [])

  async function createNew() {
    setCreating(true)
    setActionError(null)
    try {
      const note = await notesApi.createNote({ title: '', content: '' })
      setQuery('')
      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)])
      setReloadKey((k) => k + 1)
      navigate(`/notes/${note.id}`)
    } catch (err) {
      setActionError(errMsg(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    setActionError(null)
    try {
      await notesApi.deleteNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      navigate('/notes')
    } catch (err) {
      setActionError(errMsg(err))
    }
  }

  const showEditor = selectedId !== null
  const searching = debouncedQuery.trim() !== ''

  return (
    <div className={`app-shell ${showEditor ? 'has-selection' : ''}`}>
      <header className="topbar">
        <span className="brand">Notes</span>
        <span className="who">
          Signed in as <strong>{user?.username}</strong>
        </span>
        <button type="button" className="btn" onClick={logout}>
          Log out
        </button>
      </header>

      <aside className="sidebar" aria-label="Notes list">
        <div className="sidebar-head">
          <button type="button" className="btn primary block" onClick={() => void createNew()} disabled={creating}>
            {creating ? 'Creating…' : '+ New note'}
          </button>
          <label htmlFor="search" className="sr-only">
            Search notes
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {actionError && (
          <div className="alert" role="alert">
            {actionError}
          </div>
        )}

        <div className="note-list-wrap">
          {loading && notes.length === 0 ? (
            <p className="muted pad" role="status">
              Loading notes…
            </p>
          ) : listError ? (
            <div className="pad">
              <div className="alert" role="alert">
                {listError}
              </div>
              <button type="button" className="btn" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          ) : notes.length === 0 ? (
            <p className="muted pad">
              {searching ? `No notes match "${debouncedQuery.trim()}".` : 'No notes yet. Create your first one!'}
            </p>
          ) : (
            <ul className="note-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`note-item ${n.id === selectedId ? 'active' : ''}`}
                    aria-current={n.id === selectedId ? 'true' : undefined}
                    onClick={() => navigate(`/notes/${n.id}`)}
                  >
                    <span className="note-title">{n.title.trim() || 'Untitled'}</span>
                    <span className="note-snippet">{n.content.trim().slice(0, 80) || 'No content'}</span>
                    <span className="note-date">{formatDate(n.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="main-pane">
        {selectedId === null ? (
          <div className="empty-state">
            <h2>{notes.length === 0 && !searching && !loading ? 'Welcome!' : 'Select a note'}</h2>
            <p className="muted">Pick a note from the list or create a new one.</p>
          </div>
        ) : noteLoading ? (
          <p className="muted pad" role="status">
            Loading note…
          </p>
        ) : noteError ? (
          <div className="empty-state">
            <div className="alert" role="alert">
              {noteError}
            </div>
            <button type="button" className="btn" onClick={() => navigate('/notes')}>
              Back to notes
            </button>
          </div>
        ) : selected && selected.id === selectedId ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onSaved={handleSaved}
            onDelete={(id) => void handleDelete(id)}
            onBack={() => navigate('/notes')}
          />
        ) : null}
      </main>
    </div>
  )
}
