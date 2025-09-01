import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
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
  
  // Auth queries
  currentUser: () => ['auth', 'currentUser'] as const,
} as const