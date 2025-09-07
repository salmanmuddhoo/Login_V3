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
  hasSession: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  changePassword: (newPassword: string, clearNeedsPasswordReset?: boolean) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps { children: ReactNode }

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('User inactive, logging out...')
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }))
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer))
    }
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    const profile = await userProfileApi.fetchUserProfile(userId)
    return profile
  }

  // Init: check session & subscribe to auth state changes
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.user) {
          setUser(null)
          setHasSession(false)
          return
        }

        setHasSession(true)
        // Fetch profile asynchronously
        fetchUserProfile(session.user.id).then(profile => {
          if (profile?.is_active) setUser(profile)
          else supabase.auth.signOut().then(() => setUser(null))
        }).catch(() => setUser(null))
      } catch {
        setUser(null)
        setHasSession(false)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setHasSession(true)
        fetchUserProfile(session.user.id).then(profile => {
          if (profile?.is_active) setUser(profile)
          else supabase.auth.signOut().then(() => setUser(null))
        }).catch(() => setUser(null))
      } else {
        if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        setUser(null)
        setHasSession(false)
      }
    })

    return () => { subscription.subscription.unsubscribe() }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        setHasSession(true)
        const profile = await fetchUserProfile(data.user.id)
        if (!profile?.is_active) {
          await supabase.auth.signOut()
          throw new Error('Account inactive')
        }
        setUser(profile)
      }
    } catch (err: any) { setError(err.message); throw err } 
    finally { setLoading(false) }
  }

  const signOut = async () => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
    if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    setUser(null)
    setHasSession(false)
    setError(null)
    await supabase.auth.signOut().catch(() => {})
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (!sessionUser) { setUser(null); setHasSession(false); return }
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) })
      const profile = await fetchUserProfile(sessionUser.id)
      if (!profile?.is_active) { setUser(null); setHasSession(false); await supabase.auth.signOut(); return }
      setUser(profile)
      clearPermissionCache()
      resetInactivityTimer()
    } catch { /* fail silently */ }
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    setLoading(true); setError(null)
    try {
      await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
    } catch (err: any) { setError(err.message); throw err } 
    finally { setLoading(false) }
  }

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true); setError(null)
    try { 
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
    } catch (err: any) { setError(err.message); throw err } 
    finally { setLoading(false) }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, hasSession, signIn, signOut, refreshUser, changePassword, sendPasswordResetEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be within AuthProvider'); return ctx }