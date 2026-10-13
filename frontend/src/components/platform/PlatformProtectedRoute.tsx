import { Navigate } from 'react-router-dom'
import { usePlatformAuthStore } from '@/stores/platformAuth.store'

interface iPlatformProtectedRouteProps {
  children: React.ReactNode
}

export function PlatformProtectedRoute({
  children,
}: iPlatformProtectedRouteProps) {
  const isAuthenticated = usePlatformAuthStore(
    (state) => state.isAuthenticated,
  )

  if (!isAuthenticated) {
    return <Navigate to="/platform/login" replace />
  }

  return <>{children}</>
}
