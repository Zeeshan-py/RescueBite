import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../components/common/LoadingState'
import type { UserRole } from '../types/domain'
import { roleHomePath } from './route-access'
import { useAuth } from './useAuth'

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { isLoading, isAuthenticated, role, error } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState label="Loading application…" fullScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (error || !role) return <Navigate to="/account-unavailable" replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to={roleHomePath[role]} replace />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isLoading, isAuthenticated, role } = useAuth()
  if (isLoading) return <LoadingState label="Loading application…" fullScreen />
  if (isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />
  return <Outlet />
}
