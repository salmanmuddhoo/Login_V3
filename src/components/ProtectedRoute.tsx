import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission, isAdmin } from '../utils/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requiredPermission?: { resource: string; action: string }
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requiredPermission,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [internalLoading, setInternalLoading] = useState(true)

  // Debug logs
  console.log('[ProtectedRoute] loading:', loading, 'user:', user, 'path:', location.pathname)

  // Show spinner if still loading user info
  useEffect(() => {
    if (!loading && user !== null) {
      setInternalLoading(false)
    } else if (loading && user === null) {
      setInternalLoading(true)
      console.log('[ProtectedRoute] Still loading user, showing spinner...')
    }
  }, [loading, user])

  if (internalLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (user.needs_password_reset && location.pathname !== '/force-password-change') {
    console.log('[ProtectedRoute] User needs password reset, redirecting...')
    return <Navigate to="/force-password-change" replace />
  }

  if (!user.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Inactive</h2>
          <p className="text-gray-600">Your account has been deactivated. Please contact an administrator.</p>
        </div>
      </div>
    )
  }

  if (requireAdmin && !isAdmin(user)) {
    console.log('[ProtectedRoute] Require admin but user is not admin, redirecting...')
    return <Navigate to="/dashboard" replace />
  }

  if (requiredPermission && !hasPermission(user, requiredPermission.resource, requiredPermission.action)) {
    console.log('[ProtectedRoute] User missing permission:', requiredPermission)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this resource.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
