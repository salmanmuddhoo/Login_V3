import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authApi, userProfileApi } from '../lib/dataFetching'
import { queryClient, queryKeys } from '../lib/queryClient'
import { clearPermissionCache } from '../utils/permissions'

// Inactivity timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000
const LOCAL_STORAGE_KEY = "cachedUserProfile"

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

  // ✅ Load cached profile immediately on mount
  useEffect(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setUser(parsed)
        console.log("✅ Loaded cached profile from localStorage:", parsed)
      } catch {
        console.warn("⚠️ Failed to parse cached profile")
      }
    }
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.warn('⚠️ User inactive for 15 minutes, logging out...')
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
    }
  }, [user, resetInactivityTimer])

  const fetchUserProfile = async (userId: string) => {
    console.log("🔍 Fetching user profile for:", userId)
    try {
      const userProfile = await userProfileApi.fetchUserProfile(userId)
      console.log("✅ User profile obtained:", userProfile)
      // ✅ Cache in localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile))
      return userProfile
    } catch (err) {
      console.error("❌ Failed to fetch user profile:", err)
      throw err
    }
  }

  useEffect(() => {
    const init = async () => {
      console.log("🚀 Auth init starting...")
      setLoading(true)

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error("❌ Session error:", sessionError.message)
          await supabase.auth.signOut()
          setUser(null)
          localStorage.removeItem(LOCAL_STORAGE_KEY)
          return
        }

        if (session?.user) {
          console.log("✅ Session found:", session.user.id)
          try {
            const profile = await queryClient.fetchQuery({
              queryKey: queryKeys.userProfile(session.user.id),
              queryFn: () => fetchUserProfile(session.user.id),
              staleTime: Infinity,
              gcTime: Infinity,
            })

            if (profile?.is_active) {
              setUser(profile)
              console.log("✅ User is active and set in state")
            } else {
              console.warn("⚠️ User inactive, signing out")
              await supabase.auth.signOut()
              setUser(null)
              localStorage.removeItem(LOCAL_STORAGE_KEY)
            }
          } catch (err) {
            console.error("❌ Failed to fetch profile:", err)
          }
        } else {
          console.log("ℹ️ No session found")
          await supabase.auth.signOut()
          setUser(null)
          localStorage.removeItem(LOCAL_STORAGE_KEY)
        }
      } catch (err) {
        console.error("❌ Error during init:", err)
        await supabase.auth.signOut()
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state change:", event)
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
            console.log("✅ User updated after state change:", profile)
          } else {
            console.warn("⚠️ User inactive on state change, signing out")
            await supabase.auth.signOut()
            setUser(null)
            localStorage.removeItem(LOCAL_STORAGE_KEY)
          }
        } catch (err) {
          console.error("❌ Failed to refresh profile on state change:", err)
        }
      } else {
        if (user?.id) {
          queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        }
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      }
      if (loading) setLoading(false)
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log("🔑 Signing in with email:", email)
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      if (data.user) {
        console.log("✅ User signed in:", data.user.id)
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(data.user.id),
          queryFn: () => fetchUserProfile(data.user.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })

        if (!profile?.is_active) {
          console.warn("⚠️ User inactive, forcing sign out")
          await supabase.auth.signOut()
          throw new Error("Account is inactive")
        }

        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
      }
    } catch (err: any) {
      console.error("❌ Sign in error:", err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    console.log("🚪 Signing out user:", user?.id)
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    if (user?.id) {
      queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
    }
    setUser(null)
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    setError(null)
    try {
      await supabase.auth.signOut()
      console.log("✅ Supabase sign out completed")
    } catch (err) {
      console.warn("⚠️ Sign out failed silently:", err)
    }
  }

  const changePassword = async (newPassword: string, clearNeedsPasswordReset: boolean = false) => {
    console.log("🔒 Changing password")
    setLoading(true)
    setError(null)
    try {
      const result = await authApi.updatePassword(newPassword, clearNeedsPasswordReset)
      await refreshUser()
      return result
    } catch (err: any) {
      console.error("❌ Change password failed:", err)
      setError(err.message || "Failed to change password")
      throw err
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    console.log("🔄 Refreshing user profile")
    if (!user) {
      console.log("ℹ️ No user to refresh")
      return
    }
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error) {
        console.error("❌ Failed to get session user:", error.message)
        return
      }
      if (sessionUser) {
        queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(sessionUser.id) })
        const profile = await queryClient.fetchQuery({
          queryKey: queryKeys.userProfile(sessionUser.id),
          queryFn: () => fetchUserProfile(sessionUser.id),
          staleTime: Infinity,
          gcTime: Infinity,
        })
        if (!profile?.is_active) {
          console.warn("⚠️ User inactive on refresh, signing out")
          setUser(null)
          localStorage.removeItem(LOCAL_STORAGE_KEY)
          await supabase.auth.signOut()
          return
        }
        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
        clearPermissionCache()
        resetInactivityTimer()
        console.log("✅ User profile refreshed")
      } else {
        console.warn("⚠️ No session user on refresh, clearing state")
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      }
    } catch (err) {
      console.error("❌ Refresh user failed:", err)
      setError("Failed to refresh user profile. Using existing data.")
    }
  }

  const sendPasswordResetEmail = async (email: string) => {
    console.log("📧 Sending password reset email to:", email)
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      console.log("✅ Password reset email sent")
    } catch (err: any) {
      console.error("❌ Failed to send password reset:", err)
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
      sendPasswordResetEmail,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
