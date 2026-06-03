import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

/**
 * Schützt Trainer-Routen: ohne Session -> Weiterleitung auf /login.
 * Während die Session lädt, wird ein dezenter Ladezustand gezeigt.
 */
export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-ifm-gray">
        Lädt …
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
