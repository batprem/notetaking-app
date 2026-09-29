import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute, PublicOnlyRoute } from './auth/RouteGuards'
import { AuthPage } from './pages/AuthPage'
import { NotesPage } from './pages/NotesPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/notes/:id?" element={<NotesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
