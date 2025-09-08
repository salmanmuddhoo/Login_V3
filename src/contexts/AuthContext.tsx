import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { userProfileApi } from '../lib/dataFetching'
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

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[AuthContext] User inactive 15min, logging out...')
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
    console.log('[AuthContext] Fetching user profile for:', userId)
    try {
      const profile = await userProfileApi.fetchUserProfile(userId)
      console.log('[AuthContext] Profile fetched:', profile ? '✅' : '❌')
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
      console.log('[AuthContext] 📦 Initial session:', session)
      if (sessionError) throw sessionError

      if (session?.user) {
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(session.user.id),
          queryFn: () => fetchUserProfile(session.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })
        if (profile?.is_active) {
          setUser(profile)
        } else {
          console.log('[AuthContext] ⚠️ User inactive on init, signing out...')
          await supabase.auth.signOut()
          setUser(null)
        }
      } else {
        console.log('[AuthContext] No session on init, user is null')
        setUser(null)
      }
    } catch (err: any) {
      console.error('[AuthContext] Auth init error:', err)
      setUser(null)
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
      console.log('[AuthContext] Auth init finished, loading=false')
    }
  }

  useEffect(() => {
    initAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 🔄 Auth state change:', event, session)
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
            console.log('[AuthContext] ⚠️ User inactive on auth state change, signing out...')
            await supabase.auth.signOut()
            setUser(null)
          }
        } catch (err) {
          console.error('[AuthContext] Error on auth state change:', err)
        }
      } else {
        console.log('[AuthContext] User signed out')
        if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] Signing in:', email)
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        const profile = await fetchUserProfile(data.user.id)
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          throw new Error('Account is inactive')
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
    console.log('[AuthContext] Signing out...')
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    setUser(null)
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch {}
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (sessionUser) {
        const profile = await fetchUserProfile(sessionUser.id)
        if (!profile?.is_active) {
          setUser(null)
          await supabase.auth.signOut()
          return
        }
        setUser(profile)
        clearPermissionCache()
        resetInactivityTimer()
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('[AuthContext] Refresh user error:', err)
    }
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    setLoading(true)
    setError(null)
    try {
      // Replace this with your actual API call
      console.log('[AuthContext] Changing password...')
      await refreshUser()
    } catch (err: any) {
      console.error('[AuthContext] Change password error:', err)
      setError(err.message || 'Failed to change password')
      throw err
    } finally {
      setLoading(false)
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
      console.error('[AuthContext] Send password reset email error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut, refreshUser, changePassword, sendPasswordResetEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
