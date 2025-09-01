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
      },
      {
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}>
            <AdminUsers />
          </ProtectedRoute>
        ),
        loader: adminUsersLoader,
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
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
      },
      {
        path: 'settings',
        element: (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            <p className="text-gray-600 mt-2">Coming soon...</p>
          </div>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App