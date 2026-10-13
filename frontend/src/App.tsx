import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { canAccessPage, ROLE_HOME_PATH } from '@/lib/roleAccess'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const OrdersPage = lazy(() => import('@/pages/Orders').then((module) => ({ default: module.OrdersPage })))
const Reports = lazy(() => import('@/pages/Reports').then((module) => ({ default: module.Reports })))
const Customers = lazy(() => import('@/pages/Customers').then((module) => ({ default: module.Customers })))
const Users = lazy(() => import('@/pages/Users').then((module) => ({ default: module.Users })))
const Notifications = lazy(() => import('@/pages/Notifications').then((module) => ({ default: module.Notifications })))

function ProtectedRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!canAccessPage(user.role, path)) {
    return <Navigate to={ROLE_HOME_PATH[user.role]} replace />
  }
  return <>{children}</>
}

function RoleHomeRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={ROLE_HOME_PATH[user.role]} replace />
}

export default function App() {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading page" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute path="/dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute path="/orders">
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute path="/reports">
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute path="/customers">
              <Customers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute path="/users">
              <Users />
            </ProtectedRoute>}
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute path="/notifications">
              <Notifications />
            </ProtectedRoute>}
        />

        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  )
}