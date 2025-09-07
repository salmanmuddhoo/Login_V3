import React, { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { queryClient, queryKeys } from './lib/queryClient'
import { dashboardApi, adminUsersApi, rolesApi, adminRolesApi, adminPermissionsApi } from './lib/dataFetching'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginForm } from './components/LoginForm'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'

// Lazy load page components
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminUsers = React.lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })))
const AdminRoles = React.lazy(() => import('./pages/AdminRoles').then(m => ({ default: m.AdminRoles })))
const AdminPermissions = React.lazy(() => import('./pages/AdminPermissions').then(m => ({ default: m.AdminPermissions })))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))

// Loading fallback component
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

// Route loaders
const dashboardLoader = async () => {
  try {
    const [stats, activity] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.dashboardStats(), queryFn: dashboardApi.getStats }),
      queryClient.fetchQuery({ queryKey: queryKeys.dashboardActivity(), queryFn: dashboardApi.getRecentActivity }),
    ])
    return { stats, activity }
  } catch {
    return { stats: [], activity: [] }
  }
}

const adminUsersLoader = async () => {
  try {
    const [usersData, roles] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.adminUsers(), queryFn: adminUsersApi.getUsers }),
      queryClient.fetchQuery({ queryKey: queryKeys.roles(), queryFn: rolesApi.getRoles }),
    ])
    return { users: usersData.users, roles }
  } catch {
    return { users: [], roles: [] }
  }
}

const adminRolesLoader = async () => {
  try {
    const [roles, permissions] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.adminRoles(), queryFn: adminRolesApi.getRoles }),
      queryClient.fetchQuery({ queryKey: queryKeys.adminPermissions(), queryFn: adminPermissionsApi.getPermissions }),
    ])
    return { roles, permissions }
  } catch {
    return { roles: [], permissions: [] }
  }
}

const adminPermissionsLoader = async () => {
  try {
    const permissions = await queryClient.fetchQuery({
      queryKey: queryKeys.adminPermissions(),
      queryFn: adminPermissionsApi.getPermissions,
      staleTime: 10 * 60 * 1000,
    })
    return { permissions }
  } catch {
    return { permissions: [] }
  }
}

// Router configuration
const AppRouter = () => {
  const { sessionLoaded } = useAuth()

  if (!sessionLoaded) {
    return <AppLoadingFallback />
  }

  return (
    <RouterProvider
      router={createBrowserRouter([
        { path: '/login', element: <LoginForm /> },
        { path: '/forgot-password', element: <ForgotPasswordPage /> },
        { path: '/reset-password', element: <ResetPasswordPage /> },
        { path: '/force-password-change', element: <ForcePasswordChangePage /> },
        {
          path: '/',
          element: (
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          ),
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
              loader: dashboardLoader,
              hydrateFallbackElement: <PageLoadingFallback />,
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
              hydrateFallbackElement: <PageLoadingFallback />,
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
              loader: adminUsersLoader,
              hydrateFallbackElement: <PageLoadingFallback />,
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
              loader: adminRolesLoader,
              hydrateFallbackElement: <PageLoadingFallback />,
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
              loader: adminPermissionsLoader,
              hydrateFallbackElement: <PageLoadingFallback />,
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
              hydrateFallbackElement: <PageLoadingFallback />,
            },
          ],
        },
        { path: '*', element: <Navigate to="/dashboard" replace /> },
      ])}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

export default App