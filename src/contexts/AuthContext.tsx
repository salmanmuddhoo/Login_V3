import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { withTimeout } from '../utils/helpers'

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
    
    const init = async () => {
      try {
        console.log('[AuthContext] init - Getting session...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthContext] init - Session error:', sessionError)
          setUser(null)
          return
        }
        
        if (session?.user) {
          console.log('[AuthContext] init - Session found, fetching profile for user:', session.user.id)
          // Use a more reasonable timeout for initial load
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            10000, // 10 seconds for initial load
            'Initial profile fetch timed out'
          )
          setUser(profile)
          console.log('[AuthContext] init - Profile set:', profile)
        } else {
          console.log('[AuthContext] init - No session found')
          setUser(null)
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('timed out')) {
          console.error('[AuthContext] init - TIMEOUT ERROR:', err.message)
          // Don't immediately log out on timeout during init - try to recover
          setError('Loading user profile is taking longer than expected. Please refresh if needed.')
        } else {
          console.error('[AuthContext] init - CATCH ERROR:', err)
          setUser(null)
        }
      } finally {
        console.log('[AuthContext] init - Setting loading to false')
        setLoading(false)
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
          // For auth state changes, use a generous timeout to prevent automatic logout
          const profile = await withTimeout(
            fetchUserProfile(session.user.id),
            45000, // 45 seconds for auth state changes
            'Profile fetch timed out during auth state change'
          )
          setUser(profile)
          console.log('[AuthContext] Auth state change - Profile set:', profile)
        } else {
          console.log('[AuthContext] Auth state change - No session, clearing user')
          setUser(null)
          localStorage.removeItem('userProfile')
        }
      } catch (err) {
        console.error('[AuthContext] Auth state change - ERROR:', err)
        // Don't immediately clear user on auth state change errors
        // This prevents automatic logout when profile fetch fails
        setError('Failed to load user profile. Some features may not work correctly.')
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
          throw new Error('Account is inactive')
        }

        setUser(profile)
        localStorage.setItem('userProfile', JSON.stringify(profile))
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
    setLoading(true)
    
    try {
      console.log('[AuthContext] signOut - Calling Supabase auth signOut...')
      await supabase.auth.signOut()
      setUser(null)
      localStorage.removeItem('userProfile')
      console.log('[AuthContext] signOut SUCCESS')
    } catch (err: any) {
      console.error('[AuthContext] signOut ERROR:', err)
      setError(err.message)
    } finally {
      console.log('[AuthContext] signOut - Setting loading to false')
      setLoading(false)
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
    
    try {
      console.log('[AuthContext] refreshUser - Getting current user...')
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('[AuthContext] refreshUser - Error getting user:', error)
        return
      }
      
      if (sessionUser) {
        console.log('[AuthContext] refreshUser - Fetching fresh profile...')
        // For manual refresh, use a reasonable timeout but don't clear user on failure
        try {
          const profile = await withTimeout(
            fetchUserProfile(sessionUser.id),
            20000, // 20 seconds for manual refresh
            'Profile refresh timed out'
          )
          setUser(profile)
          console.log('[AuthContext] refreshUser SUCCESS - profile updated:', profile)
        } catch (timeoutErr) {
          console.error('[AuthContext] refreshUser - TIMEOUT during refresh:', timeoutErr)
          setError('Profile refresh timed out. Current session maintained.')
          // Don't clear the user - keep existing session
        }
      } else {
        console.log('[AuthContext] refreshUser - No session user found')
      }
    } catch (err) {
      console.error('[AuthContext] refreshUser ERROR:', err)
      setError('Failed to refresh user profile. Current session maintained.')
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
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut, refreshUser, changePassword, sendPasswordResetEmail }}>
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