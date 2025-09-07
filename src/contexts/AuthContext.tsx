import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { queryClient, queryKeys } from '../lib/queryClient'
import { clearPermissionCache } from '../utils/permissions'

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

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

  /** Reset inactivity timer */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('User inactive for 15 minutes, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  /** Set up inactivity monitoring */
  useEffect(() => {
    if (user) {
      resetInactivityTimer()
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      activityEvents.forEach(event =>
        window.addEventListener(event, resetInactivityTimer, { passive: true })
      )
      return () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current)
          inactivityTimerRef.current = null
        }
        activityEvents.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer)
        })
      }
    } else {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [user, resetInactivityTimer])

  /** Fetch extended user profile */
  const fetchUserProfile = async (userId: string) => {
    return await userProfileApi.fetchUserProfile(userId)
  }

  /** On app start, restore session + profile */
  useEffect(() => {
    const init = async () => {
      try {
        // Try to get existing session (refresh token if needed)
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          // Try to use cached profile first
          let profile = queryClient.getQueryData(queryKeys.userProfile(session.user.id)) as any
          if (profile) {
            setUser(profile)
          }

          // Always refresh profile in background
          try {
            profile = await queryClient.fetchQuery({
              queryKey: queryKeys.userProfile(session.user.id),
              queryFn: () => fetchUserProfile(session.user.id),
              staleTime: Infinity,
              gcTime: Infinity,
            })

            if (profile?.is_active) {
              setUser(profile)
            } else {
              await supabase.auth.signOut()
              setUser(null)
            }
          } catch {
            console.warn('Failed to refresh profile, using cached data if any')
          }
        } else {
          setUser(null)
          await supabase.auth.signOut()
        }
      } catch {
        setUser(null)
        await supabase.auth.signOut()
      } finally {
        setLoading(false)
      }
    }

    init()

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const profile = await queryClient.fetchQuery({
            queryKey: queryKeys.userProfile(session.user.id),
            queryFn: () => fetchUserProfile(session.user.id),
            staleTime: Infinity,
            gcTime: Infinity,
          })
          if (profile?.is_active) {
            setUser(profile)
          } else {
            await supabase.auth.signOut()
            setUser(null)
          }
        } catch {
          setError('Failed to refresh profile after auth state change')
        }
      } else {
        if (user?.id) {
          queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        }
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  /** Sign in with email/password */
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      if (data.user) {
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(data.user.id),
          queryFn: () => fetchUserProfile(data.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })
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

  /** Sign out */
  const signOut = async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    if (user?.id) {
      queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    }
    setUser(null)
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
  }

  /** Change password */
  const changePassword = async (newPassword: string, clearNeedsPasswordReset = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
      return result
    } catch (err: any) {
      setError(err.message || "Failed to change password")
      throw err
    } finally {
      setLoading(false)
    }
  }

  /** Force refresh profile */
  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (!sessionUser) {
        setUser(null)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) })
      const profile = await queryClient.fetchQuery({
        queryKey: queryKeys.userProfile(sessionUser.id),
        queryFn: () => fetchUserProfile(sessionUser.id),
        staleTime: Infinity,
        gcTime: Infinity,
      })
      if (!profile?.is_active) {
        setUser(null)
        await supabase.auth.signOut()
        return
      }
      setUser(profile)
      clearPermissionCache()
      resetInactivityTimer()
    } catch {
      setError('Failed to refresh user profile')
    }
  }

  /** Send password reset email */
  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}