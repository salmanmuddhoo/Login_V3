import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission, isAdmin } from '../utils/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requiredPermission?: { resource: string; action: string }
  redirectTo?: string
}

export function ProtectedRoute({ children, requireAdmin = false, requiredPermission, redirectTo = '/login' }: ProtectedRouteProps) {
  const { user, loading, hasSession } = useAuth()
  const location = useLocation()

  // Show spinner only if no session and still loading
  if (loading && !hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  // Redirect to login if no session
  if (!hasSession) return <Navigate to={redirectTo} state={{ from: location }} replace />

  // Profile checks
  if (user?.needs_password_reset && location.pathname !== '/force-password-change') return <Navigate to="/force-password-change" replace />
  if (user && !user.is_active) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white shadow-md p-6 rounded-lg text-center">
        <h2 className="text-xl font-semibold mb-2">Account Inactive</h2>
        <p>Your account has been deactivated. Contact an admin.</p>
      </div>
    </div>
  )

  if (requireAdmin && user && !isAdmin(user)) return <Navigate to="/dashboard" replace />
  if (requiredPermission && user && !hasPermission(user, requiredPermission.resource, requiredPermission.action)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white shadow-md p-6 rounded-lg text-center">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You don't have permission to access this resource.</p>
      </div>
    </div>
  )

  return <>{children}</>
}