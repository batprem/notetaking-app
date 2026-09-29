# Notetaking App

A simple note-taking web app with user accounts. Register, log in, and create, edit, and delete your own private notes.

## Stack

- **Backend:** Rust, Actix Web, SQLite (sqlx), Argon2 password hashing, JWT auth
- **Frontend:** React 19, TypeScript, Vite, React Router

## Features

- User registration and login (JWT)
- Per-user notes: list, create, view, update, delete
- Backend integration tests and frontend tests (Vitest)

## Running

### Backend

```bash
cd backend
cp .env.example .env   # then set JWT_SECRET
cargo run              # listens on http://localhost:8080
cargo test
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, proxies /api to localhost:8080
npm test
```

## Environment variables (backend)

| Variable       | Default          | Description                                                    |
|----------------|------------------|----------------------------------------------------------------|
| `JWT_SECRET`   | insecure dev key | Secret used to sign tokens. Always set this outside local dev. |
| `PORT`         | `8080`           | HTTP port                                                      |
| `DATABASE_URL` | `sqlite:notes.db`| SQLite database location                                       |
| `RUST_LOG`     | -                | Log level, e.g. `info`                                         |

## API

| Method | Path                | Description               |
|--------|---------------------|---------------------------|
| POST   | `/api/auth/register`| Create an account         |
| POST   | `/api/auth/login`   | Log in, receive a token   |
| GET    | `/api/auth/me`      | Current user              |
| GET    | `/api/notes`        | List notes                |
| POST   | `/api/notes`        | Create a note             |
| GET    | `/api/notes/{id}`   | Get a note                |
| PUT    | `/api/notes/{id}`   | Update a note             |
| DELETE | `/api/notes/{id}`   | Delete a note             |

Note endpoints require an `Authorization: Bearer <token>` header.
