import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { withTimeout } from '../utils/helpers'

// Cache keys for localStorage
const USER_CACHE_KEY = 'auth_user_profile'
const CACHE_TIMESTAMP_KEY = 'auth_cache_timestamp'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Safely get cached user data from localStorage
 */
const getCachedUser = (): any | null => {
  try {
    const cachedUser = localStorage.getItem(USER_CACHE_KEY)
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    
    if (!cachedUser || !cacheTimestamp) return null
    
    const timestamp = parseInt(cacheTimestamp, 10)
    const now = Date.now()
    
    // Check if cache is still valid (within 5 minutes)
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(USER_CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      return null
    }
    
    const user = JSON.parse(cachedUser)
    return user
  } catch (error) {
    localStorage.removeItem(USER_CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    return null
  }
}

/**
 * Safely cache user data to localStorage
 */
const setCachedUser = (user: any | null) => {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
    } else {
      localStorage.removeItem(USER_CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    }
  } catch (error) {
  }
}

/**
 * Defines the shape of the AuthContext.
 * This is what all components using `useAuth()` will have access to.
 */
interface AuthContextType {
  user: any | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  changePassword: (newPassword: string, clearNeedsPasswordReset?: boolean) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Initialize user from cache if available
  const cachedUser = getCachedUser()
  const [user, setUser] = useState<any | null>(cachedUser)
  const [loading, setLoading] = useState(false) // Start with false for instant UI
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(!!cachedUser) // Immediately initialized if cached

  /**
   * Fetches extra profile data from your custom `users` table
   * (since Supabase default auth only stores minimal info).
   */
  const fetchUserProfile = async (userId: string) => {
    try {
      const user = await userProfileApi.fetchUserProfile(userId)
      return user
    } catch (err) {
      throw err
    }
  }

  /**
   * On app start, check if a user session already exists (e.g., from cookies/localStorage).
   * If so, load their profile from the DB and set it into state.
   * Also subscribe to auth state changes (login/logout/password change).
   */
  useEffect(() => {
    // If we have cached user data, immediately initialize and start background refresh
    if (cachedUser) {
      setUser(cachedUser)
      setLoading(false)
      setIsInitialized(true)
      
      // Start background refresh to ensure data is current
      const backgroundRefresh = async () => {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError || !session?.user) {
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          // Fetch fresh profile data in background
          const freshProfile = await withTimeout(
            fetchUserProfile(session.user.id),
            15000, // 15 seconds for background refresh
            'Background profile refresh timed out'
          )
          
          // Check if user account is still active
          if (!freshProfile?.is_active) {
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          // Only update if data has changed
          if (JSON.stringify(freshProfile) !== JSON.stringify(cachedUser)) {
            setUser(freshProfile)
            setCachedUser(freshProfile)
          } else {
          }
          
          // Clear any previous errors
          setError(null)
        } catch (err) {
          // Don't clear user on background refresh failure - just show warning
          if (err instanceof Error && err.message.includes('timed out')) {
            setError('Profile data may be outdated. Please refresh if needed.')
          } else {
            setError('Unable to refresh profile data. Some features may not work correctly.')
          }
        }
      }
      
      // Start background refresh after a short delay to not block initial render
      setTimeout(backgroundRefresh, 100)
      return
    }
    
    // No cached data - proceed with full initialization
    const init = async () => {
      setLoading(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          setUser(null)
          // Clear any invalid tokens
          await supabase.auth.signOut()
          return
        }
        
        if (session?.user) {
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            10000, // 10 seconds for initial load
            'Initial profile fetch timed out'
          )
          
          // Check if user account is active
          if (!profile?.is_active) {
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
        } else {
          setUser(null)
          setCachedUser(null)
          // Ensure clean state if no session
          await supabase.auth.signOut()
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('timed out')) {
          setError('Loading user profile is taking longer than expected. Please refresh if needed.')
        } else {
          setUser(null)
          setCachedUser(null)
          // Clear any invalid tokens on error
          await supabase.auth.signOut()
        }
      } finally {
        setLoading(false)
        setIsInitialized(true)
      }
    }

    init()

    // Listen for sign in/out/password changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            20000, // 20 seconds for auth state changes
            'Profile fetch timed out during auth state change'
          )
          
          // Check if user account is active
          if (!profile?.is_active) {
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
        } else {
          setUser(null)
          setCachedUser(null)
        }
        
        // Set loading to false after auth state change is processed
        if (loading) {
          setLoading(false)
        }
        setIsInitialized(true)
      } catch (err) {
        // For auth state changes, be more graceful with errors
        if (err instanceof Error && err.message.includes('timed out')) {
          setError('Profile refresh timed out. Using existing session data.')
        } else {
          setError('Failed to refresh user profile. Some features may not work correctly.')
        }
        setIsInitialized(true)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  /**
   * Signs in a user with email + password using Supabase auth.
   * If successful, fetches their extended profile and saves it locally.
   */
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        throw error
      }

      if (data.user) {
        const profile = await withTimeout(
          fetchUserProfile(data.user.id),
          8000,
          'Profile fetch timed out during sign in'
        )

        // prevent inactive accounts from signing in
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          throw new Error('Account is inactive')
        }

        setUser(profile)
        setCachedUser(profile)
      }
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  /**
   * Logs the user out from Supabase and clears local state.
   */
  const signOut = async () => {
    // Immediately clear user state and cache for instant UI feedback
    setUser(null)
    setCachedUser(null)
    setError(null)
    
    try {
      // Perform actual signout in background
      await supabase.auth.signOut()
    } catch (err: any) {
      // Don't show error for signout failures - user is already logged out from UI perspective
    }
  }

  /**
   * Changes the user's password using the secure Edge Function approach.
   * @param newPassword - The new password to set
   * @param clearNeedsPasswordReset - Whether to clear the needs_password_reset flag (default: false)
   */
  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    setLoading(true)
    setError(null)

    try {
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      
      // Refresh user profile to get updated data
      await refreshUser()
      
      return result
    } catch (err: any) {
      setError(err.message || "Failed to change password")
      throw err
    } finally {
      setLoading(false)
    }
  }

  /**
   * Force refresh the current user profile from the DB.
   * Useful after updating roles or other user data.
   */
  const refreshUser = async () => {
    if (!user) {
      return
    }
    
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      
      if (error) {
        return
      }
      
      if (sessionUser) {
        try {
          const profile = await withTimeout(
            fetchUserProfile(sessionUser.id),
            15000, // 15 seconds for manual refresh
            'Profile refresh timed out'
          )
          
          // Check if user account is still active
          if (!profile?.is_active) {
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
          
          // Clear permission cache when user data changes
          clearPermissionCache()
        } catch (timeoutErr) {
          setError('Profile refresh timed out. Using existing data.')
        }
      } else {
        setUser(null)
        setCachedUser(null)
      }
    } catch (err) {
      setError('Failed to refresh user profile. Using existing data.')
    }
  }

  /**
   * Sends a password reset email with a redirect URL.
   * User will click link → be redirected → enter new password.
   */
  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) {
        throw error
      }
      
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }


  return (
    <AuthContext.Provider value={{ 
      user, 
      loading: loading && !isInitialized, // Only show loading if not initialized and no cached data
      error, 
      signIn, 
      signOut, 
      refreshUser, 
      changePassword, 
      sendPasswordResetEmail 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Custom hook for consuming AuthContext.
 * Throws if used outside an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}