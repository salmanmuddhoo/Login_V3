import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { withTimeout } from '../utils/helpers'
import { queryClient, queryKeys } from '../lib/queryClient';
import { clearPermissionCache } from '../utils/permissions';

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

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
    console.log('⏰ AuthContext: Resetting inactivity timer')
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // Only set timer if user is logged in
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('⏰ AuthContext: User inactive for 15 minutes, auto-logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
      console.log('⏰ AuthContext: Inactivity timer set for 15 minutes')
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
    console.log('🔍 AuthContext: Starting fetchUserProfile for:', userId)
    try {
      const user = await userProfileApi.fetchUserProfile(userId)
      console.log('✅ AuthContext: fetchUserProfile successful:', {
        userId: user?.id,
        email: user?.email,
        rolesCount: user?.roles?.length || 0,
        permissionsCount: user?.permissions?.length || 0
      })
      return user
    } catch (err) {
      console.error('❌ AuthContext: fetchUserProfile failed:', err)
      throw err
    }
  }

  /**
   * On app start, check if a user session already exists (e.g., from cookies/localStorage).
   * If so, load their profile from the DB and set it into state.
   * Also subscribe to auth state changes (login/logout/password change).
   */
  useEffect(() => {
    console.log('🔄 AuthContext: Starting initialization...')
    const init = async () => {
      setLoading(true)
      console.log('🔄 AuthContext: Getting session...')
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('📊 AuthContext: Session data:', {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'Present' : 'Missing',
          refreshToken: session?.refresh_token ? 'Present' : 'Missing',
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
          sessionError: sessionError?.message
        })
        
        if (sessionError) {
          console.error('❌ AuthContext: Session error:', sessionError)
          setUser(null)
          // Clear any invalid tokens
          await supabase.auth.signOut()
          return
        }
        
        if (session?.user) {
          console.log('👤 AuthContext: Fetching user profile for:', session.user.id)
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(session.user.id),
            queryFn: () => fetchUserProfile(session.user.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          console.log('📋 AuthContext: User profile fetched:', {
            userId: profile?.id,
            email: profile?.email,
            fullName: profile?.full_name,
            isActive: profile?.is_active,
            needsPasswordReset: profile?.needs_password_reset,
            rolesCount: profile?.roles?.length || 0,
            permissionsCount: profile?.permissions?.length || 0
          })
          
          // Check if user account is active
          if (profile?.is_active) {
            console.log('✅ AuthContext: User is active, setting user state')
            setUser(profile)
          } else {
            console.warn('⚠️ AuthContext: User account is inactive, signing out')
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          console.log('👤 AuthContext: No session user found')
          setUser(null)
          // Ensure clean state if no session
          await supabase.auth.signOut()
        }
      } catch (err) {
        console.error('❌ AuthContext: Error during initialization:', err)
        setUser(null)
        // Clear any invalid tokens on error
        await supabase.auth.signOut()
      } finally {
        console.log('🏁 AuthContext: Initialization complete, setting loading to false')
        setLoading(false)
      }
    }

    init()

    // Listen for sign in/out/password changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 AuthContext: Auth state change:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        accessToken: session?.access_token ? 'Present' : 'Missing'
      })
      
      try {
        if (session?.user) {
          console.log('👤 AuthContext: Auth change - fetching user profile for:', session.user.id)
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(session.user.id),
            queryFn: () => fetchUserProfile(session.user.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          console.log('📋 AuthContext: Auth change - user profile fetched:', {
            userId: profile?.id,
            isActive: profile?.is_active,
            needsPasswordReset: profile?.needs_password_reset
          })
          
          // Check if user account is active
          if (profile?.is_active) {
            console.log('✅ AuthContext: Auth change - user is active, setting user state')
            setUser(profile)
          } else {
            console.warn('⚠️ AuthContext: Auth change - user account is inactive, signing out')
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          console.log('👤 AuthContext: Auth change - no session user, clearing state')
          if (user?.id) {
            queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) });
          }
          setUser(null)
        }
        
        // Set loading to false after auth state change is processed
        if (loading) {
          console.log('🏁 AuthContext: Auth change complete, setting loading to false')
          setLoading(false)
        }
      } catch (err) {
        console.error('❌ AuthContext: Error during auth state change:', err)
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
    console.log('🔐 AuthContext: Starting signIn for:', email)
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      console.log('📊 AuthContext: SignIn response:', {
        hasUser: !!data.user,
        userId: data.user?.id,
        hasSession: !!data.session,
        accessToken: data.session?.access_token ? 'Present' : 'Missing',
        error: error?.message
      })
      
      if (error) {
        console.error('❌ AuthContext: SignIn error:', error)
        throw error
      }

      if (data.user) {
        console.log('👤 AuthContext: SignIn - fetching user profile')
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(data.user.id),
          queryFn: () => fetchUserProfile(data.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        });

        console.log('📋 AuthContext: SignIn - profile check:', {
          isActive: profile?.is_active,
          needsPasswordReset: profile?.needs_password_reset
        })
        
        // prevent inactive accounts from signing in
        if (!profile?.is_active) {
          console.warn('⚠️ AuthContext: SignIn - account is inactive')
          await supabase.auth.signOut()
          throw new Error('Account is inactive')
        }

        console.log('✅ AuthContext: SignIn successful, setting user state')
        setUser(profile)
      }
    } catch (err: any) {
      console.error('❌ AuthContext: SignIn failed:', err)
      setError(err.message)
      throw err
    } finally {
      console.log('🏁 AuthContext: SignIn complete, setting loading to false')
      setLoading(false)
    }
  }

  /**
   * Logs the user out from Supabase and clears local state.
   */
  const signOut = async () => {
    console.log('🚪 AuthContext: Starting signOut')
    // Clear inactivity timer immediately
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
      console.log('⏰ AuthContext: Inactivity timer cleared')
    }

    // Immediately clear user state and cache for instant UI feedback
    if (user?.id) {
      queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) });
      console.log('🗑️ AuthContext: User cache cleared for:', user.id)
    }
    setUser(null)
    setError(null)
    console.log('🧹 AuthContext: User state cleared')
    
    try {
      // Perform actual signout in background
      await supabase.auth.signOut()
      console.log('✅ AuthContext: Supabase signOut successful')
    } catch (err: any) {
      console.error('❌ AuthContext: Supabase signOut error (ignored):', err)
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
    console.log('🔄 AuthContext: Starting refreshUser')
    if (!user) {
      console.log('👤 AuthContext: No user to refresh')
      return
    }
    
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      
      console.log('📊 AuthContext: RefreshUser session check:', {
        hasSessionUser: !!sessionUser,
        userId: sessionUser?.id,
        error: error?.message
      })
      
      if (error) {
        console.error('❌ AuthContext: RefreshUser session error:', error)
        return
      }
      
      if (sessionUser) {
        try {
          // Invalidate cache to ensure fresh data
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) });
          console.log('🗑️ AuthContext: User profile cache invalidated')
          
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(sessionUser.id),
            queryFn: () => fetchUserProfile(sessionUser.id),
            staleTime: Infinity,
            gcTime: Infinity,
          });
          
          console.log('📋 AuthContext: RefreshUser profile fetched:', {
            isActive: profile?.is_active,
            rolesCount: profile?.roles?.length || 0
          })
          
          // Check if user account is still active
          if (!profile?.is_active) {
            console.warn('⚠️ AuthContext: RefreshUser - account is now inactive')
            setUser(null)
            await supabase.auth.signOut()
            return
          }
          
          setUser(profile)
          console.log('✅ AuthContext: RefreshUser successful')
          
          // Clear permission cache when user data changes
          clearPermissionCache()
          
          // Reset inactivity timer with fresh user data
          resetInactivityTimer()
        } catch (timeoutErr) {
          console.error('❌ AuthContext: RefreshUser timeout:', timeoutErr)
          setError('Profile refresh timed out. Using existing data.')
        }
      } else {
        console.log('👤 AuthContext: RefreshUser - no session user found')
        setUser(null)
      }
    } catch (err) {
      console.error('❌ AuthContext: RefreshUser error:', err)
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