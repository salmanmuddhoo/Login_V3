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

  useEffect(() => {
    if (user) {
      resetInactivityTimer()
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
      activityEvents.forEach(event => {
        window.addEventListener(event, resetInactivityTimer, { passive: true })
      })
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

  const fetchUserProfile = async (userId: string) => {
    return await userProfileApi.fetchUserProfile(userId)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Session error:", sessionError)
          setUser(null)
          return
        }

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
              console.warn("Inactive account")
              await supabase.auth.signOut()
              setUser(null)
            }
          } catch (err) {
            console.error("Profile fetch failed:", err)
            // fallback: at least keep Supabase session user
            setUser(session.user)
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error("Init error:", err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
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
          } catch (err) {
            console.error("Profile refresh failed:", err)
            setUser(session.user)
          }
        } else {
          if (user?.id) {
            queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
          }
          setUser(null)
        }
      } catch (err) {
        console.error("Auth state change error:", err)
        setError("Auth state update failed.")
      } finally {
        setLoading(false)
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
      /* ignore */
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
      setError(err.message || "Failed to change password")
      throw err
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error) return
      if (sessionUser) {
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
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error("Refresh user error:", err)
      setError("Failed to refresh user profile. Using existing data.")
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