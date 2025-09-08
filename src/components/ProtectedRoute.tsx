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
  const { user, loading } = useAuth()
  const location = useLocation()

  console.log('[ProtectedRoute] loading:', loading, 'user:', user, 'path:', location.pathname)

  if (loading) {
    console.log('[ProtectedRoute] Still loading user, showing spinner...')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to={redirectTo} state={{ from: location }} replace />
  if (user.needs_password_reset && location.pathname !== '/force-password-change') return <Navigate to="/force-password-change" replace />
  if (!user.is_active) return <div className="min-h-screen flex items-center justify-center"><p>Account inactive</p></div>
  if (requireAdmin && !isAdmin(user)) return <Navigate to="/dashboard" replace />
  if (requiredPermission && !hasPermission(user, requiredPermission.resource, requiredPermission.action)) return <div>Access denied</div>

  return <>{children}</>
}
