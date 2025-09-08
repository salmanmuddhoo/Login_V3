import React, { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { queryClient, queryKeys } from './lib/queryClient'
import { dashboardApi, adminUsersApi, rolesApi, adminRolesApi, adminPermissionsApi } from './lib/dataFetching'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginForm } from './components/LoginForm'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'

// Lazy load page components
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })))
const AdminUsers = React.lazy(() => import('./pages/AdminUsers').then(module => ({ default: module.AdminUsers })))
const AdminRoles = React.lazy(() => import('./pages/AdminRoles').then(module => ({ default: module.AdminRoles })))
const AdminPermissions = React.lazy(() => import('./pages/AdminPermissions').then(module => ({ default: module.AdminPermissions })))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })))

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
      <p className="text-gray-600">Loading app...</p>
    </div>
  </div>
)

// --- Route loaders with logging ---
const dashboardLoader = async () => {
  console.log("[Loader] dashboardLoader called")
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
    console.log("[Loader] dashboardLoader success", { stats, activity })
    return { stats, activity }
  } catch (error) {
    console.error("[Loader] dashboardLoader error:", error)
    return { stats: [], activity: [] }
  }
}

const adminUsersLoader = async () => {
  console.log("[Loader] adminUsersLoader called")
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
    console.log("[Loader] adminUsersLoader success")
    return { users: usersData.users, roles }
  } catch (error) {
    console.error("[Loader] adminUsersLoader error:", error)
    return { users: [], roles: [] }
  }
}

const adminRolesLoader = async () => {
  console.log("[Loader] adminRolesLoader called")
  try {
    const [roles, permissions] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.adminRoles(),
        queryFn: adminRolesApi.getRoles,
      }),
      queryClient.fetchQuery({
        queryKey: queryKeys.adminPermissions(),
        queryFn: adminPermissionsApi.getPermissions,
      }),
    ])
    console.log("[Loader] adminRolesLoader success")
    return { roles, permissions }
  } catch (error) {
    console.error("[Loader] adminRolesLoader error:", error)
    return { roles: [], permissions: [] }
  }
}

const adminPermissionsLoader = async () => {
  console.log("[Loader] adminPermissionsLoader called")
  try {
    const permissions = await queryClient.fetchQuery({
      queryKey: queryKeys.adminPermissions(),
      queryFn: adminPermissionsApi.getPermissions,
      staleTime: 10 * 60 * 1000,
    })
    console.log("[Loader] adminPermissionsLoader success")
    return { permissions }
  } catch (error) {
    console.error("[Loader] adminPermissionsLoader error:", error)
    return { permissions: [] }
  }
}

// --- Router config ---
const router = createBrowserRouter([
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
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'reports', action: 'view' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
                <p className="text-gray-600 mt-2">Coming soon...</p>
              </div>
            </Suspense>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'transactions', action: 'create' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
                <p className="text-gray-600 mt-2">Coming soon...</p>
              </div>
            </Suspense>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'analytics',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'reports', action: 'view' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
                <p className="text-gray-600 mt-2">Coming soon...</p>
              </div>
            </Suspense>
          </ProtectedRoute>
        ),
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoadingFallback />}>
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-2">Coming soon...</p>
            </div>
          </Suspense>
        ),
        hydrateFallbackElement: <PageLoadingFallback />,
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
], {
  future: {
    v7_partialHydration: true,
  },
})

function App() {
  console.log("[App] Mounting application...")
  return (
    <AuthProvider>
      <RouterProvider router={router} fallbackElement={<AppLoadingFallback />} />
    </AuthProvider>
  )
}

export default App
