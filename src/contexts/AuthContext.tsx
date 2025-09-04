import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { withTimeout } from '../utils/helpers'
import { queryClient, queryKeys } from '../lib/queryClient';
import { clearPermissionCache } from '../utils/permissions';

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

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
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Resets the inactivity timer. Called on user interactions and when user logs in.
   */
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // Only set timer if user is logged in
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('User inactive for 15 minutes, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  /**
   * Set up inactivity monitoring when user is logged in
   */
  useEffect(() => {
    if (user) {
      // Start the inactivity timer
      resetInactivityTimer()

      // Activity event listeners
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      
      activityEvents.forEach(event => {
        window.addEventListener(event, resetInactivityTimer, { passive: true })
      })

      // Cleanup function
      return () => {
        // Clear the timer
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current)
          inactivityTimerRef.current = null
        }

        // Remove event listeners
        activityEvents.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer)
        })
      }
    } else {
      // Clear timer if user is not logged in
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [user, resetInactivityTimer])

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
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(session.user.id),
            queryFn: () => fetchUserProfile(session.user.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          // Check if user account is active
          if (profile?.is_active) {
            setUser(profile)
          } else {
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          setUser(null)
          // Ensure clean state if no session
          await supabase.auth.signOut()
        }
      } catch (err) {
        setUser(null)
        // Clear any invalid tokens on error
        await supabase.auth.signOut()
      } finally {
        setLoading(false)
      }
    }

    init()

    // Listen for sign in/out/password changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(session.user.id),
            queryFn: () => fetchUserProfile(session.user.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          // Check if user account is active
          if (profile?.is_active) {
            setUser(profile)
          } else {
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          if (user?.id) {
            queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) });
          }
          setUser(null)
        }
        
        // Set loading to false after auth state change is processed
        if (loading) {
          setLoading(false)
        }
      } catch (err) {
        // For auth state changes, be more graceful with errors
        if (err instanceof Error && err.message.includes('timed out')) {
          setError('Profile refresh timed out. Using existing session data.')
        } else {
          setError('Failed to refresh user profile. Some features may not work correctly.')
        }
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
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(data.user.id),
          queryFn: () => fetchUserProfile(data.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        });

        // prevent inactive accounts from signing in
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          throw new Error('Account is inactive')
        }

        setUser(profile)
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
    // Clear inactivity timer immediately
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // Immediately clear user state and cache for instant UI feedback
    if (user?.id) {
      queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) });
    }
    setUser(null)
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
          // Invalidate cache to ensure fresh data
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) });
          
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(sessionUser.id),
            queryFn: () => fetchUserProfile(sessionUser.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          // Check if user account is still active
          if (!profile?.is_active) {
            setUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          
          // Clear permission cache when user data changes
          clearPermissionCache()
          
          // Reset inactivity timer with fresh user data
          resetInactivityTimer()
        } catch (timeoutErr) {
          setError('Profile refresh timed out. Using existing data.')
        }
      } else {
        setUser(null)
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
      loading,
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