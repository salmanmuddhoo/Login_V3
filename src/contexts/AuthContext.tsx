import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { userProfileApi } from '../lib/dataFetching'
import { queryClient, queryKeys } from '../lib/queryClient'
import { clearPermissionCache } from '../utils/permissions'
import type { User } from '../types/auth'

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

// Auth states for better granular control
interface AuthState {
  user: User | null
  isInitializing: boolean
  isSigningIn: boolean
  isSigningOut: boolean
  isRefreshing: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  changePassword: (newPassword: string, clearNeedsPasswordReset?: boolean) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isInitializing: true,
    isSigningIn: false,
    isSigningOut: false,
    isRefreshing: false,
    error: null
  })

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const authListenerRef = useRef<{ data: { subscription: any } } | null>(null)

  // Helper to update auth state
  const updateAuthState = useCallback((updates: Partial<AuthState>) => {
    setAuthState(prev => ({ ...prev, ...updates }))
  }, [])

  // Clear error helper
  const clearError = useCallback(() => {
    updateAuthState({ error: null })
  }, [updateAuthState])

  // Inactivity timer management
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    
    if (authState.user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[AuthContext] User inactive for 15 minutes, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [authState.user])

  // Setup/cleanup inactivity tracking
  useEffect(() => {
    if (authState.user) {
      resetInactivityTimer()
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      
      activityEvents.forEach(event => 
        window.addEventListener(event, resetInactivityTimer, { passive: true })
      )
      
      return () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current)
        }
        activityEvents.forEach(event => 
          window.removeEventListener(event, resetInactivityTimer)
        )
      }
    }
  }, [authState.user, resetInactivityTimer])

  // Fetch user profile with comprehensive error handling
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    console.log(`[AuthContext] 🔍 Fetching user profile for: ${userId}`)
    try {
      const profile = await userProfileApi.fetchUserProfile(userId)
      console.log('[AuthContext] ✅ Profile fetched successfully', profile)
      return profile
    } catch (error) {
      console.error('[AuthContext] ❌ Failed to fetch user profile:', error)
      throw error
    }
  }, [])

  // Handle session validation and user setup
  const handleSessionUser = useCallback(async (sessionUser: any): Promise<User | null> => {
    if (!sessionUser) return null

    try {
      const profile = await fetchUserProfile(sessionUser.id)
      
      if (!profile) {
        console.warn('[AuthContext] ⚠️ No profile found for user')
        return null
      }

      if (!profile.is_active) {
        console.warn('[AuthContext] ⚠️ User account is inactive')
        await supabase.auth.signOut()
        return null
      }

      return profile
    } catch (error) {
      console.error('[AuthContext] ❌ Error handling session user:', error)
      return null
    }
  }, [fetchUserProfile])

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    console.log('[AuthContext] 🚀 Initializing authentication...')
    updateAuthState({ isInitializing: true, error: null })

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[AuthContext] ❌ Session error during init:', sessionError)
        await supabase.auth.signOut()
        updateAuthState({ user: null, error: sessionError.message })
        return
      }

      console.log('[AuthContext] 📦 Initial session:', session ? 'Found' : 'None')
      
      if (session?.user) {
        const user = await handleSessionUser(session.user)
        updateAuthState({ user })
      } else {
        updateAuthState({ user: null })
      }
    } catch (error) {
      console.error('[AuthContext] ❌ Auth initialization failed:', error)
      updateAuthState({ 
        user: null, 
        error: error instanceof Error ? error.message : 'Authentication initialization failed' 
      })
      await supabase.auth.signOut()
    } finally {
      updateAuthState({ isInitializing: false })
    }
  }, [updateAuthState, handleSessionUser])

  // Handle auth state changes from Supabase
  const handleAuthStateChange = useCallback(async (event: string, session: any) => {
    console.log(`[AuthContext] 🔄 Auth state change: ${event}`, session ? 'with session' : 'no session')
    
    try {
      switch (event) {
        case 'SIGNED_IN':
          console.log('[AuthContext] ✅ User signed in')
          if (session?.user) {
            const user = await handleSessionUser(session.user)
            updateAuthState({ user, error: null })
            clearPermissionCache()
          }
          break

        case 'SIGNED_OUT':
          console.log('[AuthContext] 👋 User signed out')
          if (authState.user?.id) {
            queryClient.removeQueries({ queryKey: queryKeys.userProfile(authState.user.id) })
          }
          updateAuthState({ user: null, error: null })
          clearPermissionCache()
          break

        case 'TOKEN_REFRESHED':
          console.log('[AuthContext] 🔄 Token refreshed')
          if (session?.user && authState.user) {
            // Optionally refresh user profile on token refresh
            try {
              const user = await handleSessionUser(session.user)
              updateAuthState({ user })
              clearPermissionCache()
            } catch (error) {
              console.error('[AuthContext] ❌ Error refreshing user after token refresh:', error)
            }
          }
          break

        case 'USER_UPDATED':
          console.log('[AuthContext] 📝 User updated')
          if (session?.user && authState.user) {
            try {
              const user = await handleSessionUser(session.user)
              updateAuthState({ user })
              clearPermissionCache()
            } catch (error) {
              console.error('[AuthContext] ❌ Error updating user:', error)
            }
          }
          break

        default:
          console.log(`[AuthContext] ℹ️ Unhandled auth event: ${event}`)
      }
    } catch (error) {
      console.error(`[AuthContext] ❌ Error handling auth state change (${event}):`, error)
      updateAuthState({ 
        error: error instanceof Error ? error.message : 'Authentication error occurred' 
      })
    }
  }, [authState.user, updateAuthState, handleSessionUser])

  // Setup auth listener on mount
  useEffect(() => {
    initializeAuth()

    // Setup auth state change listener
    authListenerRef.current = supabase.auth.onAuthStateChange(handleAuthStateChange)

    return () => {
      if (authListenerRef.current) {
        authListenerRef.current.data.subscription.unsubscribe()
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [initializeAuth, handleAuthStateChange])

  // Sign in method
  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] 🔐 Attempting sign in for:', email)
    updateAuthState({ isSigningIn: true, error: null })

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        console.error('[AuthContext] ❌ Sign in error:', error)
        throw error
      }

      if (data.user) {
        const profile = await handleSessionUser(data.user)
        if (!profile) {
          throw new Error('Unable to load user profile or account is inactive')
        }
        updateAuthState({ user: profile })
        console.log('[AuthContext] ✅ Sign in successful')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      console.error('[AuthContext] ❌ Sign in failed:', errorMessage)
      updateAuthState({ error: errorMessage })
      throw error
    } finally {
      updateAuthState({ isSigningIn: false })
    }
  }, [updateAuthState, handleSessionUser])

  // Sign out method
  const signOut = useCallback(async () => {
    console.log('[AuthContext] 👋 Signing out...')
    updateAuthState({ isSigningOut: true, error: null })

    try {
      // Clear timers
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }

      // Clear user-specific cache
      if (authState.user?.id) {
        queryClient.removeQueries({ queryKey: queryKeys.userProfile(authState.user.id) })
      }

      // Clear permissions cache
      clearPermissionCache()

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[AuthContext] ❌ Sign out error:', error)
        throw error
      }

      updateAuthState({ user: null })
      console.log('[AuthContext] ✅ Sign out successful')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      console.error('[AuthContext] ❌ Sign out failed:', errorMessage)
      updateAuthState({ error: errorMessage })
      throw error
    } finally {
      updateAuthState({ isSigningOut: false })
    }
  }, [authState.user, updateAuthState])

  // Refresh user method
  const refreshUser = useCallback(async () => {
    if (!authState.user) return

    console.log('[AuthContext] 🔄 Refreshing user...')
    updateAuthState({ isRefreshing: true, error: null })

    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('[AuthContext] ❌ Error getting current user:', error)
        throw error
      }

      if (sessionUser) {
        const profile = await handleSessionUser(sessionUser)
        updateAuthState({ user: profile })
        clearPermissionCache()
        console.log('[AuthContext] ✅ User refresh successful')
      } else {
        updateAuthState({ user: null })
        console.log('[AuthContext] ℹ️ No current user found during refresh')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh user'
      console.error('[AuthContext] ❌ User refresh failed:', errorMessage)
      updateAuthState({ error: errorMessage })
      throw error
    } finally {
      updateAuthState({ isRefreshing: false })
    }
  }, [authState.user, updateAuthState, handleSessionUser])

  // Change password method
  const changePassword = useCallback(async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    console.log('[AuthContext] 🔑 Changing password...')
    updateAuthState({ error: null })

    try {
      const { authApi } = await import('../lib/dataFetching')
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
      console.log('[AuthContext] ✅ Password change successful')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password'
      console.error('[AuthContext] ❌ Password change failed:', errorMessage)
      updateAuthState({ error: errorMessage })
      throw error
    }
  }, [updateAuthState, refreshUser])

  // Send password reset email method
  const sendPasswordResetEmail = useCallback(async (email: string) => {
    console.log('[AuthContext] 📧 Sending password reset email to:', email)
    updateAuthState({ error: null })

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { 
        redirectTo: `${window.location.origin}/reset-password` 
      })
      
      if (error) {
        console.error('[AuthContext] ❌ Password reset email error:', error)
        throw error
      }

      console.log('[AuthContext] ✅ Password reset email sent successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send password reset email'
      console.error('[AuthContext] ❌ Send password reset email failed:', errorMessage)
      updateAuthState({ error: errorMessage })
      throw error
    }
  }, [updateAuthState])

  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    refreshUser,
    changePassword,
    sendPasswordResetEmail,
    clearError
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}