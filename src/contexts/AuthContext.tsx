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
  error: string | null
  signIn: (email: string, password: string) => Promise<any>
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

  const fetchProfile = async (userId: string) => {
    try {
      console.log(`🔍 Fetching user profile for: ${userId}`)
      const profile = await queryClient.fetchQuery({
        queryKey: queryKeys.userProfile(userId),
        queryFn: () => userProfileApi.fetchUserProfile(userId),
        staleTime: Infinity,
        gcTime: Infinity,
      })
      console.log('✅ Profile fetched:', profile)
      return profile
    } catch (err) {
      console.error('❌ Error fetching profile:', err)
      throw err
    }
  }

  const initAuth = async () => {
    console.log('🚀 Auth init starting...')
    setLoading(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('📦 Initial session:', session)
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        await supabase.auth.signOut()
        setUser(null)
      } else if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (profile?.is_active) setUser(profile)
        else {
          console.log('⚠️ User inactive, signing out...')
          await supabase.auth.signOut()
          setUser(null)
        }
      } else {
        console.log('⚠️ No session found')
        setUser(null)
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.error('🔥 Auth init failed:', err)
      setUser(null)
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initAuth()
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🌀 Auth state change:', event, session)
      if (session?.user) {
        try {
          const profile = await fetchProfile(session.user.id)
          if (profile?.is_active) setUser(profile)
          else {
            console.log('⚠️ User inactive after auth change, signing out...')
            await supabase.auth.signOut()
            setUser(null)
          }
        } catch (err) {
          console.error('❌ Error during auth state change:', err)
        } finally {
          setLoading(false)
        }
      } else {
        console.log('🚪 Signed out, clearing user')
        if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        setUser(null)
        setLoading(false)
      }
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in with:', email)
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('❌ Sign in error:', error)
        setError(error.message)
        return { error }
      }
      console.log('✅ Sign in success:', data)
      if (data.user) {
        const profile = await fetchProfile(data.user.id)
        if (!profile?.is_active) {
          console.log('⚠️ Account inactive, signing out...')
          await supabase.auth.signOut()
          setUser(null)
          setError('Account inactive')
          return { error: 'Account inactive' }
        }
        setUser(profile)
      }
      return { user: data.user }
    } catch (err: any) {
      console.error('🔥 Unexpected sign in error:', err)
      setError(err.message)
      return { error: err }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    console.log('🚪 Logging out user...')
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    setUser(null)
    setError(null)
    try {
      await supabase.auth.signOut()
      console.log('✅ Sign out success')
    } catch (err) {
      console.error('❌ Sign out failed:', err)
    }
  }

  const refreshUser = async () => {
    if (!user) return
    console.log('🔄 Refreshing user profile...')
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error) console.error('❌ Error getting session user:', error)
      if (sessionUser) {
        const profile = await fetchProfile(sessionUser.id)
        if (!profile?.is_active) {
          console.log('⚠️ User inactive on refresh, signing out...')
          setUser(null)
          await supabase.auth.signOut()
          return
        }
        setUser(profile)
        clearPermissionCache()
        resetInactivityTimer()
      } else setUser(null)
    } catch (err) {
      console.error('🔥 Failed to refresh user:', err)
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
      console.error('❌ Change password failed:', err)
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    } catch (err: any) {
      console.error('❌ Password reset email failed:', err)
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
