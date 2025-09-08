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
  const { user, loading, refreshUser } = useAuth()
  const location = useLocation()

  const [initialized, setInitialized] = useState(false)
  const [localUser, setLocalUser] = useState<any | null>(null)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)

  // ✅ On first render, use cached user from AuthContext or localStorage
  useEffect(() => {
    if (user) {
      setLocalUser(user)
      setInitialized(true)
    } else {
      const cached = localStorage.getItem('cachedUserProfile')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setLocalUser(parsed)
          console.log("✅ Using cached user in ProtectedRoute:", parsed)
        } catch {
          console.warn("⚠️ Failed to parse cached user in ProtectedRoute")
          setLocalUser(null)
        }
      }
      setInitialized(true)
    }
  }, [user])

  // ✅ Background refresh: fetch latest profile if cached user exists
  useEffect(() => {
    if (localUser) {
      setBackgroundRefreshing(true)
      refreshUser()
        .then(() => {
          console.log("🔄 Background user refresh completed")
        })
        .catch(err => {
          console.warn("⚠️ Background refresh failed:", err)
        })
        .finally(() => setBackgroundRefreshing(false))
    }
  }, [localUser, refreshUser])

  // Only show spinner if no cached user and still loading
  if ((loading || !initialized) && !localUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!localUser) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Check if user needs to change their password
  if (localUser.needs_password_reset && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />
  }

  if (!localUser.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Inactive</h2>
          <p className="text-gray-600">Your account has been deactivated. Please contact an administrator.</p>
        </div>
      </div>
    )
  }

  if (requireAdmin && !isAdmin(localUser)) {
    return <Navigate to="/dashboard" replace />
  }

  if (requiredPermission && !hasPermission(localUser, requiredPermission.resource, requiredPermission.action)) {
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
