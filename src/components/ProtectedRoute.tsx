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

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requiredPermission,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, hasSession, loading } = useAuth()
  const location = useLocation()

  if ((loading || !user) && hasSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!hasSession) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (user.needs_password_reset && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />
  }

  if (!user.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6