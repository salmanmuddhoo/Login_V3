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
const StaffReportsPage = React.lazy(() => import('./pages/StaffReportsPage').then(m => ({ default: m.StaffReportsPage })))

// Loading fallback
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

// 🔹 Helper to wait for AuthContext user before loader runs
const waitForAuth = async (): Promise<any | null> => {
  // We cannot directly call hook outside component, so we wrap in a promise in loader
  return new Promise(resolve => {
    const check = () => {
      const { user, loading } = window.authContext ?? { user: null, loading: true }
      if (!loading) resolve(user)
      else setTimeout(check, 50)
    }
    check()
  })
}

// Attach user state globally so loaders can access
export const AuthContextLoaderWrapper: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const auth = useAuth()
  (window as any).authContext = auth
  return <>{children}</>
}

// --------------------- Loaders ---------------------

const dashboardLoader = async () => {
  const user = await waitForAuth()
  if (!user) return { stats: [], activity: [] }

  console.log('📊 App: Starting dashboardLoader...')
  try {
    const [stats, activity] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.dashboardStats(), queryFn: dashboardApi.getStats }),
      queryClient.fetchQuery({ queryKey: queryKeys.dashboardActivity(), queryFn: dashboardApi.getRecentActivity }),
    ])
    return { stats, activity }
  } catch (error) {
    console.error('❌ App: Dashboard loader failed:', error)
    return { stats: [], activity: [] }
  }
}

const adminUsersLoader = async () => {
  const user = await waitForAuth()
  if (!user) return { users: [], roles: [] }

  console.log('👥 App: Starting adminUsersLoader...')
  try {
    const [usersData, roles] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.adminUsers(), queryFn: adminUsersApi.getUsers }),
      queryClient.fetchQuery({ queryKey: queryKeys.roles(), queryFn: rolesApi.getRoles }),
    ])
    return { users: usersData.users, roles }
  } catch (error) {
    console.error('❌ App: Admin users loader failed:', error)
    return { users: [], roles: [] }
  }
}

const adminRolesLoader = async () => {
  const user = await waitForAuth()
  if (!user) return { roles: [], permissions: [] }

  console.log('🛡️ App: Starting adminRolesLoader...')
  try {
    const [roles, permissions] = await Promise.all([
      queryClient.fetchQuery({ queryKey: queryKeys.adminRoles(), queryFn: adminRolesApi.getRoles }),
      queryClient.fetchQuery({ queryKey: queryKeys.adminPermissions(), queryFn: adminPermissionsApi.getPermissions }),
    ])
    return { roles, permissions }
  } catch (error) {
    console.error('❌ App: Admin roles loader failed:', error)
    return { roles: [], permissions: [] }
  }
}

const adminPermissionsLoader = async () => {
  const user = await waitForAuth()
  if (!user) return { permissions: [] }

  console.log('🔑 App: Starting adminPermissionsLoader...')
  try {
    const permissions = await queryClient.fetchQuery({ queryKey: queryKeys.adminPermissions(), queryFn: adminPermissionsApi.getPermissions })
    return { permissions }
  } catch (error) {
    console.error('❌ App: Admin permissions loader failed:', error)
    return { permissions: [] }
  }
}

// --------------------- Router ---------------------
const router = createBrowserRouter([
  { path: '/login', element: <LoginForm /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/force-password-change', element: <ForcePasswordChangePage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AuthContextLoaderWrapper>
          <Layout />
        </AuthContextLoaderWrapper>
      </ProtectedRoute>
    ),
    hydrateFallbackElement: <AppLoadingFallback />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'access' }}>
            <Suspense fallback={<PageLoadingFallback />}><Dashboard /></Suspense>
          </ProtectedRoute>
        ),
        loader: dashboardLoader,
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'users', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}><AdminUsers /></Suspense>
          </ProtectedRoute>
        ),
        loader: adminUsersLoader,
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'admin/roles',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'roles', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}><AdminRoles /></Suspense>
          </ProtectedRoute>
        ),
        loader: adminRolesLoader,
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'admin/permissions',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'permissions', action: 'manage' }}>
            <Suspense fallback={<PageLoadingFallback />}><AdminPermissions /></Suspense>
          </ProtectedRoute>
        ),
        loader: adminPermissionsLoader,
        hydrateFallbackElement: <PageLoadingFallback />,
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}><ProfilePage /></Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission={{ resource: 'reports', action: 'view' }}>
            <Suspense fallback={<PageLoadingFallback />}><StaffReportsPage /></Suspense>
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
], { future: { v7_partialHydration: true } })

// --------------------- App Component ---------------------
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
