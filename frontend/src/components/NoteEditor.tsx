import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, notesApi, type Note } from '../api'

const AUTOSAVE_MS = 800

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

interface Props {
  note: Note
  onSaved: (note: Note) => void
  onDelete: (id: number) => void
  onBack: () => void
}

/** Rendered with key={note.id}, so local state is initialised once per note. */
export function NoteEditor({ note, onSaved, onDelete, onBack }: Props) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [status, setStatus] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)

  const latest = useRef({ title: note.title, content: note.content })
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  const save = useCallback(async () => {
    if (inFlight.current) return // the running save re-triggers itself if still dirty
    inFlight.current = true
    try {
      while (dirty.current) {
        dirty.current = false
        const snapshot = { ...latest.current }
        if (mounted.current) setStatus('saving')
        try {
          const saved = await notesApi.updateNote(note.id, snapshot)
          onSavedRef.current(saved)
          if (mounted.current) {
            setSaveError(null)
            setStatus(dirty.current ? 'saving' : 'saved')
          }
        } catch (err) {
          dirty.current = true
          if (mounted.current) {
            setSaveError(err instanceof ApiError ? err.message : 'Failed to save')
            setStatus('error')
          }
          return
        }
      }
    } finally {
      inFlight.current = false
    }
  }, [note.id])

  const schedule = useCallback(() => {
    dirty.current = true
    setStatus('unsaved')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
  }, [save])

  // Flush pending edits when switching notes or leaving the page.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
      if (dirty.current) void save()
    }
  }, [save])

  function changeTitle(value: string) {
    setTitle(value)
    latest.current.title = value
    schedule()
  }

  function changeContent(value: string) {
    setContent(value)
    latest.current.content = value
    schedule()
  }

  function confirmDelete() {
    if (window.confirm(`Delete "${title.trim() || 'Untitled'}"? This cannot be undone.`)) {
      if (timer.current) clearTimeout(timer.current)
      dirty.current = false
      onDelete(note.id)
    }
  }

  const statusText: Record<SaveState, string> = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: saveError ? `Save failed: ${saveError}` : 'Save failed',
  }

  return (
    <section className="editor" aria-label="Note editor">
      <div className="editor-bar">
        <button type="button" className="btn ghost back-btn" onClick={onBack}>
          ← Notes
        </button>
        <span className={`save-status ${status}`} role="status" aria-live="polite">
          {statusText[status]}
        </span>
        {status === 'error' && (
          <button type="button" className="btn" onClick={() => void save()}>
            Retry
          </button>
        )}
        <button type="button" className="btn danger" onClick={confirmDelete}>
          Delete
        </button>
      </div>
      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      <input
        id="note-title"
        className="title-input"
        placeholder="Title"
        value={title}
        onChange={(e) => changeTitle(e.target.value)}
      />
      <label htmlFor="note-content" className="sr-only">
        Content
      </label>
      <textarea
        id="note-content"
        className="content-input"
        placeholder="Start writing…"
        value={content}
        onChange={(e) => changeContent(e.target.value)}
      />
    </section>
  )
}
