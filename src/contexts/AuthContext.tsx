import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { queryClient, queryKeys } from '../lib/queryClient'
import { clearPermissionCache } from '../utils/permissions'

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

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[AuthContext] User inactive 15min, signing out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      resetInactivityTimer()
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
        events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      }
    }
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('[AuthContext] Fetching user profile for:', userId)
      const profile = await userProfileApi.fetchUserProfile(userId)
      console.log('[AuthContext] Profile fetched:', profile)
      return profile
    } catch (err) {
      console.error('[AuthContext] Error fetching profile:', err)
      throw err
    }
  }

  const initAuth = async () => {
    console.log('[AuthContext] 🚀 Auth init starting...')
    setLoading(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[AuthContext] Error getting session:', sessionError)
        setUser(null)
        await supabase.auth.signOut()
        return
      }
      console.log('[AuthContext] 📦 Initial session:', session)

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        if (!profile?.is_active) {
          console.log('[AuthContext] Account inactive, signing out...')
          setUser(null)
          await supabase.auth.signOut()
        } else {
          setUser(profile)
        }
      } else {
        setUser(null)
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.error('[AuthContext] Error initializing auth:', err)
      setUser(null)
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
      console.log('[AuthContext] Auth init complete. user:', user)
    }
  }

  useEffect(() => {
    initAuth()
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 🔄 Auth state change:', event, session)
      if (session?.user) {
        try {
          const profile = await fetchUserProfile(session.user.id)
          if (!profile?.is_active) {
            console.log('[AuthContext] Account inactive after auth change, signing out...')
            setUser(null)
            await supabase.auth.signOut()
          } else {
            setUser(profile)
          }
        } catch (err) {
          console.error('[AuthContext] Failed to fetch profile on auth change:', err)
          setUser(null)
        } finally {
          setLoading(false)
        }
      } else {
        console.log('[AuthContext] Signed out, clearing user')
        if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        setUser(null)
        setLoading(false)
      }
    })
    return () => subscription.subscription.unsubscribe()
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
      console.error('[AuthContext] SignIn error:', err)
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
    try { await supabase.auth.signOut() } catch {}
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
      return result
    } catch (err: any) {
      console.error('[AuthContext] ChangePassword error:', err)
      setError(err.message || 'Failed to change password')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error || !sessionUser) return
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) })
      const profile = await fetchUserProfile(sessionUser.id)
      if (!profile?.is_active) {
        setUser(null)
        await supabase.auth.signOut()
        return
      }
      setUser(profile)
      clearPermissionCache()
      resetInactivityTimer()
    } catch (err) {
      console.error('[AuthContext] refreshUser error:', err)
    }
  }

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
    } catch (err: any) {
      console.error('[AuthContext] sendPasswordResetEmail error:', err)
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
