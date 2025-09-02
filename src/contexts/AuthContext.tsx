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
      console.log('[AuthContext] Cache expired, clearing...')
      localStorage.removeItem(USER_CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      return null
    }
    
    const user = JSON.parse(cachedUser)
    console.log('[AuthContext] Using cached user:', user)
    return user
  } catch (error) {
    console.error('[AuthContext] Error reading cached user:', error)
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
      console.log('[AuthContext] User cached successfully')
    } else {
      localStorage.removeItem(USER_CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      console.log('[AuthContext] User cache cleared')
    }
  } catch (error) {
    console.error('[AuthContext] Error caching user:', error)
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
    console.log('[AuthContext] fetchUserProfile START - userId:', userId)
    
    try {
      const user = await userProfileApi.fetchUserProfile(userId)
      console.log('[AuthContext] fetchUserProfile SUCCESS - user:', user)
      return user
    } catch (err) {
      console.error('[AuthContext] fetchUserProfile CATCH ERROR:', err)
      throw err
    }
  }

  /**
   * On app start, check if a user session already exists (e.g., from cookies/localStorage).
   * If so, load their profile from the DB and set it into state.
   * Also subscribe to auth state changes (login/logout/password change).
   */
  useEffect(() => {
    console.log('[AuthContext] useEffect INIT START')
    
    // If we have cached user data, immediately initialize and start background refresh
    if (cachedUser) {
      console.log('[AuthContext] Using cached user for immediate initialization:', cachedUser)
      setUser(cachedUser)
      setLoading(false)
      setIsInitialized(true)
      
      // Start background refresh to ensure data is current
      const backgroundRefresh = async () => {
        try {
          console.log('[AuthContext] Starting background refresh for cached user')
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError || !session?.user) {
            console.log('[AuthContext] Background refresh - No valid session, clearing cache')
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
            console.log('[AuthContext] Background refresh - User account is inactive, signing out')
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          // Only update if data has changed
          if (JSON.stringify(freshProfile) !== JSON.stringify(cachedUser)) {
            console.log('[AuthContext] Background refresh - Data changed, updating user')
            setUser(freshProfile)
            setCachedUser(freshProfile)
          } else {
            console.log('[AuthContext] Background refresh - No changes detected')
          }
          
          // Clear any previous errors
          setError(null)
        } catch (err) {
          console.error('[AuthContext] Background refresh failed:', err)
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
        console.log('[AuthContext] init - Getting session...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthContext] init - Session error:', sessionError)
          setUser(null)
          // Clear any invalid tokens
          await supabase.auth.signOut()
          return
        }
        
        if (session?.user) {
          console.log('[AuthContext] init - Session found, fetching profile for user:', session.user.id)
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            10000, // 10 seconds for initial load
            'Initial profile fetch timed out'
          )
          
          // Check if user account is active
          if (!profile?.is_active) {
            console.log('[AuthContext] init - User account is inactive')
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
          console.log('[AuthContext] init - Profile set:', profile)
        } else {
          console.log('[AuthContext] init - No session found')
          setUser(null)
          setCachedUser(null)
          // Ensure clean state if no session
          await supabase.auth.signOut()
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('timed out')) {
          console.error('[AuthContext] init - TIMEOUT ERROR:', err.message)
          setError('Loading user profile is taking longer than expected. Please refresh if needed.')
        } else {
          console.error('[AuthContext] init - CATCH ERROR:', err)
          setUser(null)
          setCachedUser(null)
          // Clear any invalid tokens on error
          await supabase.auth.signOut()
        }
      } finally {
        console.log('[AuthContext] init - Setting loading to false')
        setLoading(false)
        setIsInitialized(true)
      }
    }

    init()

    // Listen for sign in/out/password changes
    console.log('[AuthContext] Setting up auth state listener')
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state change - event:', event, 'session:', !!session)
      
      try {
        if (session?.user) {
          console.log('[AuthContext] Auth state change - Fetching profile for user:', session.user.id)
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            20000, // 20 seconds for auth state changes
            'Profile fetch timed out during auth state change'
          )
          
          // Check if user account is active
          if (!profile?.is_active) {
            console.log('[AuthContext] Auth state change - User account is inactive, signing out')
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
          console.log('[AuthContext] Auth state change - Profile set:', profile)
        } else {
          console.log('[AuthContext] Auth state change - No session, clearing user')
          setUser(null)
          setCachedUser(null)
        }
        
        // Set loading to false after auth state change is processed
        if (loading) {
          setLoading(false)
        }
        setIsInitialized(true)
      } catch (err) {
        console.error('[AuthContext] Auth state change - ERROR:', err)
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
      console.log('[AuthContext] Cleaning up auth state listener')
      subscription.subscription.unsubscribe()
    }
  }, [])

  /**
   * Signs in a user with email + password using Supabase auth.
   * If successful, fetches their extended profile and saves it locally.
   */
  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] signIn START - email:', email)
    setLoading(true)
    setError(null)
    
    try {
      console.log('[AuthContext] signIn - Calling Supabase auth...')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        console.error('[AuthContext] signIn - Auth error:', error)
        throw error
      }

      if (data.user) {
        console.log('[AuthContext] signIn - Auth successful, fetching profile...')
        const profile = await withTimeout(
          fetchUserProfile(data.user.id),
          8000,
          'Profile fetch timed out during sign in'
        )

        // prevent inactive accounts from signing in
        if (!profile?.is_active) {
          console.error('[AuthContext] signIn - Account is inactive')
          await supabase.auth.signOut()
          throw new Error('Account is inactive')
        }

        setUser(profile)
        setCachedUser(profile)
        console.log('[AuthContext] signIn SUCCESS - user set:', profile)
      }
    } catch (err: any) {
      console.error('[AuthContext] signIn ERROR:', err)
      setError(err.message)
      throw err
    } finally {
      console.log('[AuthContext] signIn - Setting loading to false')
      setLoading(false)
    }
  }

  /**
   * Logs the user out from Supabase and clears local state.
   */
  const signOut = async () => {
    console.log('[AuthContext] signOut START')
    
    // Immediately clear user state and cache for instant UI feedback
    setUser(null)
    setCachedUser(null)
    setError(null)
    console.log('[AuthContext] signOut - User state cleared immediately')
    
    try {
      console.log('[AuthContext] signOut - Calling Supabase auth signOut...')
      // Perform actual signout in background
      await supabase.auth.signOut()
      console.log('[AuthContext] signOut SUCCESS')
    } catch (err: any) {
      console.error('[AuthContext] signOut ERROR:', err)
      // Don't show error for signout failures - user is already logged out from UI perspective
    }
  }

  /**
   * Changes the user's password using the secure Edge Function approach.
   * @param newPassword - The new password to set
   * @param clearNeedsPasswordReset - Whether to clear the needs_password_reset flag (default: false)
   */
  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    console.log("[AuthContext] changePassword START", { newPassword: !!newPassword, clearNeedsPasswordReset })
    setLoading(true)
    setError(null)

    try {
      console.log("[AuthContext] changePassword - Calling Edge Function...")
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      console.log("[AuthContext] changePassword - Edge Function completed successfully", result)
      
      // Refresh user profile to get updated data
      console.log("[AuthContext] changePassword - Refreshing user profile...")
      await refreshUser()
      console.log("[AuthContext] changePassword SUCCESS")
      
      return result
    } catch (err: any) {
      console.error("[AuthContext] changePassword ERROR:", err)
      setError(err.message || "Failed to change password")
      throw err
    } finally {
      console.log("[AuthContext] changePassword - Setting loading to false")
      setLoading(false)
    }
  }

  /**
   * Force refresh the current user profile from the DB.
   * Useful after updating roles or other user data.
   */
  const refreshUser = async () => {
    console.log('[AuthContext] refreshUser START')
    
    if (!user) {
      console.log('[AuthContext] refreshUser - No user to refresh')
      return
    }
    
    try {
      console.log('[AuthContext] refreshUser - Getting current user...')
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('[AuthContext] refreshUser - Error getting user:', error)
        return
      }
      
      if (sessionUser) {
        console.log('[AuthContext] refreshUser - Fetching fresh profile...')
        try {
          const profile = await withTimeout(
            fetchUserProfile(sessionUser.id),
            15000, // 15 seconds for manual refresh
            'Profile refresh timed out'
          )
          
          // Check if user account is still active
          if (!profile?.is_active) {
            console.log('[AuthContext] refreshUser - User account is inactive, signing out')
            setUser(null)
            setCachedUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          setCachedUser(profile)
          console.log('[AuthContext] refreshUser SUCCESS - profile updated:', profile)
          
          // Clear permission cache when user data changes
          clearPermissionCache()
        } catch (timeoutErr) {
          console.error('[AuthContext] refreshUser - TIMEOUT during refresh:', timeoutErr)
          setError('Profile refresh timed out. Using existing data.')
        }
      } else {
        console.log('[AuthContext] refreshUser - No session user found')
        setUser(null)
        setCachedUser(null)
      }
    } catch (err) {
      console.error('[AuthContext] refreshUser ERROR:', err)
      setError('Failed to refresh user profile. Using existing data.')
    }
  }

  /**
   * Sends a password reset email with a redirect URL.
   * User will click link → be redirected → enter new password.
   */
  const sendPasswordResetEmail = async (email: string) => {
    console.log('[AuthContext] sendPasswordResetEmail START - email:', email)
    setLoading(true)
    setError(null)
    
    try {
      console.log('[AuthContext] sendPasswordResetEmail - Calling Supabase...')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) {
        console.error('[AuthContext] sendPasswordResetEmail - Error:', error)
        throw error
      }
      
      console.log('[AuthContext] sendPasswordResetEmail SUCCESS')
    } catch (err: any) {
      console.error('[AuthContext] sendPasswordResetEmail ERROR:', err)
      setError(err.message)
      throw err
    } finally {
      console.log('[AuthContext] sendPasswordResetEmail - Setting loading to false')
      setLoading(false)
    }
  }

  console.log('[AuthContext] Render - user:', !!user, 'loading:', loading, 'error:', error)

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