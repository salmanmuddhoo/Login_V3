import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient, queryKeys } from '../lib/queryClient'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { clearPermissionCache } from '../utils/permissions'

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

interface AuthContextType {
  user: any | null
  loading: boolean
  sessionLoaded: boolean
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
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initializingRef = useRef(false) // Prevent race conditions

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    return userProfileApi.fetchUserProfile(userId)
  }

  const handleAuthStateChange = async (session: any) => {
    try {
      if (session?.user) {
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(session.user.id),
          queryFn: () => fetchUserProfile(session.user.id),
          staleTime: Infinity,
        })

        if (!profile?.is_active) {
          await supabase.auth.signOut()
          setUser(null)
        } else {
          setUser(profile)
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Auth state change error:', err)
      setUser(null)
    }
  }

  // Load session on app start
  useEffect(() => {
    const init = async () => {
      if (initializingRef.current) return // Prevent multiple initializations
      initializingRef.current = true
      
      setLoading(true)
      setSessionLoaded(false)
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        await handleAuthStateChange(session)
      } catch (err) {
        console.error('Session initialization error:', err)
        setUser(null)
      } finally {
        setLoading(false)
        setSessionLoaded(true)
        initializingRef.current = false
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Don't handle auth changes during initial setup
      if (initializingRef.current) return
      
      try {
        await handleAuthStateChange(session)
      } catch (err) {
        console.error('Auth state change error:', err)
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

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (sessionUser) {
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
      }
    } catch {}
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset = false) => {
    setLoading(true)
    try {
      await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
    } finally { setLoading(false) }
  }

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    } finally { setLoading(false) }
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionLoaded, error, signIn, signOut, refreshUser, changePassword, sendPasswordResetEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}