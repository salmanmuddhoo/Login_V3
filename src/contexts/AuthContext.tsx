import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
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
        console.log('User inactive for 15 minutes, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
    }
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    return userProfileApi.fetchUserProfile(userId)
  }

  const loadSessionAndProfile = async () => {
    setLoading(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      if (session?.user) {
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(session.user.id),
          queryFn: () => fetchUserProfile(session.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })
        if (profile?.is_active) setUser(profile)
        else {
          await supabase.auth.signOut()
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Failed to load session/profile:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessionAndProfile()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(session.user.id),
          queryFn: () => fetchUserProfile(session.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })
        if (profile?.is_active) setUser(profile)
        else {
          await supabase.auth.signOut()
          setUser(null)
        }
      } else {
        setUser(null)
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
      if (!data.user) throw new Error('No user returned from Supabase')
      const profile = await fetchUserProfile(data.user.id)
      if (!profile?.is_active) {
        await supabase.auth.signOut()
        throw new Error('Account is inactive')
      }
      setUser(profile)
    } catch (err: any) {
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
    } catch {}
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (!sessionUser) {
        setUser(null)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) })
      const profile = await fetchUserProfile(sessionUser.id)
      if (!profile?.is_active) {
        await supabase.auth.signOut()
        setUser(null)
        return
      }
      setUser(profile)
      clearPermissionCache()
      resetInactivityTimer()
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    setLoading(true)
    setError(null)
    try {
      await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
    } catch (err: any) {
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
