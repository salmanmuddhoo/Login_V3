import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { queryClient, queryKeys } from './lib/queryClient'
import { dashboardApi, adminUsersApi, rolesApi } from './lib/dataFetching'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginForm } from './components/LoginForm'
import { Dashboard } from './pages/Dashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminUsers } from './pages/AdminUsers'
import { ProfilePage } from './pages/ProfilePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
)

// Route loaders for data prefetching
const dashboardLoader = async () => {
  console.log('[App] dashboardLoader START')
  
  try {
    // Prefetch dashboard data
    const [stats, activity] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.dashboardStats(),
        queryFn: dashboardApi.getStats,
      }),
      queryClient.fetchQuery({
        queryKey: queryKeys.dashboardActivity(),
        queryFn: dashboardApi.getRecentActivity,
      }),
    ])
    
    console.log('[App] dashboardLoader SUCCESS')
    return { stats, activity }
  } catch (error) {
    console.error('[App] dashboardLoader ERROR:', error)
    // Return empty data on error - components will handle loading states
    return { stats: [], activity: [] }
  }
}

const adminUsersLoader = async () => {
  console.log('[App] adminUsersLoader START')
  
  try {
    // Prefetch users and roles data
    const [usersData, roles] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.adminUsers(),
        queryFn: adminUsersApi.getUsers,
      }),
      queryClient.fetchQuery({
        queryKey: queryKeys.roles(),
        queryFn: rolesApi.getRoles,
      }),
    ])
    
    console.log('[App] adminUsersLoader SUCCESS')
    return { users: usersData.users, roles }
  } catch (error) {
    console.error('[App] adminUsersLoader ERROR:', error)
    // Return empty data on error - components will handle loading states
    return { users: [], roles: [] }
  }
}

// Router configuration with loaders
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
    hydrateFallbackElement: <LoadingFallback />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'access' }}>
            <Dashboard />
          </ProtectedRoute>
        ),
        loader: dashboardLoader,
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}>
            <AdminUsers />
          </ProtectedRoute>
        ),
        loader: adminUsersLoader,
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'reports', action: 'view' }}>
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
              <p className="text-gray-600 mt-2">Coming soon...</p>
            </div>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'transactions', action: 'create' }}>
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
              <p className="text-gray-600 mt-2">Coming soon...</p>
            </div>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'analytics',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'reports', action: 'view' }}>
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
              <p className="text-gray-600 mt-2">Coming soon...</p>
            </div>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
      {
        path: 'settings',
        element: (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            <p className="text-gray-600 mt-2">Coming soon...</p>
          </div>
        ),
        hydrateFallbackElement: <LoadingFallback />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
], {
  future: {
    v7_partialHydration: true,
  },
})

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App