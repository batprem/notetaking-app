import { request } from './client'
import type { Note, NoteInput } from './types'

export const listNotes = (q?: string, signal?: AbortSignal): Promise<Note[]> => {
  const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return request<Note[]>(`/notes${query}`, { signal })
}

export const createNote = (input: NoteInput): Promise<Note> =>
  request<Note>('/notes', { method: 'POST', body: input })

export const getNote = (id: number, signal?: AbortSignal): Promise<Note> =>
  request<Note>(`/notes/${id}`, { signal })

export const updateNote = (id: number, input: NoteInput): Promise<Note> =>
  request<Note>(`/notes/${id}`, { method: 'PUT', body: input })

export const deleteNote = (id: number): Promise<void> =>
  request<void>(`/notes/${id}`, { method: 'DELETE' })
