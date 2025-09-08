import React, { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { queryClient, queryKeys } from './lib/queryClient'
import { dashboardApi, adminUsersApi, rolesApi } from './lib/dataFetching'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginForm } from './components/LoginForm'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminUsers = React.lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })))
const AdminRoles = React.lazy(() => import('./pages/AdminRoles').then(m => ({ default: m.AdminRoles })))
const AdminPermissions = React.lazy(() => import('./pages/AdminPermissions').then(m => ({ default: m.AdminPermissions })))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))

// Loading fallback components
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
      <p className="text-gray-600 text-sm">Loading page...</p>
    </div>
  </div>
)

const AppLoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
)

/**
 * Wrapper to ensure router only renders after auth is loaded
 */
const RouterWithAuthGuard = () => {
  const { loading } = useAuth()

  if (loading) {
    return <AppLoadingFallback />
  }

  return <RouterProvider router={router} />
}

// ROUTER CONFIGURATION (same as your current routes)
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginForm />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/force-password-change',
    element: <ForcePasswordChangePage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    hydrateFallbackElement: <AppLoadingFallback />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'access' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'users', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminUsers />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'roles', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminRoles />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/permissions',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'permissions', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminPermissions />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      // Other routes (reports, transactions, analytics, settings) can follow the same pattern
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
], { future: { v7_partialHydration: true } })

// MAIN APP COMPONENT
function App() {
  return (
    <AuthProvider>
      <RouterWithAuthGuard />
    </AuthProvider>
  )
}

export default App
