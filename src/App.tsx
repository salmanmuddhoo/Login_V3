import React, { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { queryClient, queryKeys } from './lib/queryClient'
import { dashboardApi, adminUsersApi, rolesApi } from './lib/dataFetching'
import { AuthProvider } from './contexts/AuthContext'
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
const StaffReportsPage = React.lazy(() => import('./pages/StaffReportsPage').then(m => ({ default: m.StaffReportsPage })))

// Per-page loading fallback
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
      <p className="text-gray-600 text-sm">Loading page...</p>
    </div>
  </div>
)

// Route loaders
const dashboardLoader = async () => {
  try {
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
    return { stats, activity }
  } catch {
    return { stats: [], activity: [] }
  }
}

const adminUsersLoader = async () => {
  try {
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
    return { users: usersData.users, roles }
  } catch {
    return { users: [], roles: [] }
  }
}

const adminRolesLoader = async () => {
  try {
    const [roles, permissions] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.adminRoles(),
        queryFn: rolesApi.getRoles,
      }),
      queryClient.fetchQuery({
        queryKey: queryKeys.permissions(),
        queryFn: rolesApi.getPermissions,
      }),
    ])
    return { roles, permissions }
  } catch {
    return { roles: [], permissions: [] }
  }
}

// Router config
const router = createBrowserRouter([
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
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <Dashboard />
          </Suspense>
        ),
        loader: dashboardLoader,
      },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <AdminUsers />
          </Suspense>
        ),
        loader: adminUsersLoader,
      },
      {
        path: 'admin/roles',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <AdminRoles />
          </Suspense>
        ),
        loader: adminRolesLoader,
      },
      {
        path: 'admin/permissions',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <AdminPermissions />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: 'staff-reports',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <StaffReportsPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: '/login', element: <LoginForm /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/force-password-change', element: <ForcePasswordChangePage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export const App = () => (
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
)