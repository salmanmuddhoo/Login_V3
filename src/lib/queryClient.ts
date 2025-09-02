import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 2 minutes (faster refresh)
      staleTime: 5 * 60 * 1000,
      // Cache data for 5 minutes (shorter cache for more up-to-date data)
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Disable refetch on window focus for better performance
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Only refetch on mount if data is stale (improved performance)
      refetchOnMount: true,
      // Keep previous data while fetching new data for smooth transitions
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      // Faster retry for mutations
      retryDelay: 1000,
    },
  },
})

// Query keys for consistent caching
export const queryKeys = {
  // User-related queries
  user: (userId: string) => ['user', userId] as const,
  userProfile: (userId: string) => ['userProfile', userId] as const,
  
  // Dashboard queries
  dashboardStats: () => ['dashboard', 'stats'] as const,
  dashboardActivity: () => ['dashboard', 'activity'] as const,
  
  // Admin queries
  adminUsers: () => ['admin', 'users'] as const,
  roles: () => ['roles'] as const,
  adminRoles: () => ['admin', 'roles'] as const,
  adminPermissions: () => ['admin', 'permissions'] as const,
  
  // Auth queries
  currentUser: () => ['auth', 'currentUser'] as const,
} as const