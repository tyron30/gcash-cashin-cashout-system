import { Navigate, useLocation } from 'react-router-dom'
import Spinner from '../components/common/Spinner'
import { useAuth } from '../hooks/useAuth'
import AccountStatusPage from '../pages/AccountStatusPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'

// Not signed in -> login page. Inactive account -> waiting page.
// Signed in but not the owner -> "no access". (Real security is the database.)
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { profile, isAuthenticated, isAdmin, loading, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Checking your session…" />

  if (profileError && !profile) return <AccountStatusPage kind="error" message={profileError} />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile.isActive) return <AccountStatusPage kind="inactive" />

  if (adminOnly && !isAdmin) return <UnauthorizedPage />

  return children
}
