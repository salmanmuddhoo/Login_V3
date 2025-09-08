import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { queryClient, queryKeys } from '../lib/queryClient'
import { clearPermissionCache } from '../utils/permissions'

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

interface AuthContextType {
  user: any | null
  loading: boolean
  initializing: boolean
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
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('User inactive for 15 minutes, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      resetInactivityTimer()
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      activityEvents.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
        activityEvents.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      }
    }
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    console.log(`[AuthContext] 🔍 Fetching user profile for: ${userId}`)
    try {
      const profile = await userProfileApi.fetchUserProfile(userId)
      console.log('[AuthContext] ✅ Profile fetched', profile)
      return profile
    } catch (err) {
      console.error('[AuthContext] ❌ Failed to fetch profile', err)
      throw err
    }
  }

  // INIT AUTH SESSION
  useEffect(() => {
    const init = async () => {
      console.log('[AuthContext] 🚀 Auth init starting...')
      setLoading(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[AuthContext] 📦 Initial session:', session)

        if (sessionError) {
          console.error('[AuthContext] ❌ Session error', sessionError)
          await supabase.auth.signOut()
          setUser(null)
          return
        }

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          if (profile?.is_active) {
            setUser(profile)
          } else {
            console.warn('[AuthContext] ⚠️ Inactive account, signing out')
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('[AuthContext] ❌ Init failed', err)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 🔄 Auth state change:', event, session)
      try {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          if (profile?.is_active) setUser(profile)
          else {
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
          setUser(null)
        }
      } catch (err) {
        console.error('[AuthContext] ❌ Auth state change error', err)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        const profile = await fetchUserProfile(data.user.id)
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          throw new Error('Account inactive')
        }
        setUser(profile)
      }
    } catch (err: any) {
      console.error('[AuthContext] ❌ SignIn failed', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    setUser(null)
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[AuthContext] ❌ SignOut error', err)
    }
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error) throw error
      if (sessionUser) {
        const profile = await fetchUserProfile(sessionUser.id)
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          setUser(null)
          return
        }
        setUser(profile)
        clearPermissionCache()
        resetInactivityTimer()
      } else setUser(null)
    } catch (err) {
      console.error('[AuthContext] ❌ Refresh user failed', err)
    }
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
      return result
    } catch (err: any) {
      console.error('[AuthContext] ❌ Change password failed', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
    } catch (err: any) {
      console.error('[AuthContext] ❌ Send reset email failed', err)
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
      initializing,
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
