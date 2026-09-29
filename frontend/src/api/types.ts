export interface User {
  id: number
  username: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Credentials {
  username: string
  password: string
}

export interface Note {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface NoteInput {
  title: string
  content: string
}
