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
  const [user, setUser] = useState<any | null>(() => {
    // Try to load cached user from localStorage
    try {
      const cached = localStorage.getItem('cachedUserProfile')
      return cached ? JSON.parse(cached) : null
    } catch (err) {
      console.warn('⚠️ Failed to parse cached user profile', err)
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Helper to set user both in state and in localStorage
  const setUserAndCache = (profile: any | null) => {
    setUser(profile)
    if (profile) {
      try {
        localStorage.setItem('cachedUserProfile', JSON.stringify(profile))
      } catch (err) {
        console.warn('⚠️ Failed to cache user profile in localStorage', err)
      }
    } else {
      localStorage.removeItem('cachedUserProfile')
    }
  }

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
      let checkpoints = {
        session: false,
        accessToken: false,
        refreshToken: false,
        profile: false,
        activeFlag: false
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error("❌ Session error:", sessionError.message)
          await supabase.auth.signOut()
          setUserAndCache(null)
          return
        }

        if (session) {
          checkpoints.session = true
          if (session.access_token) checkpoints.accessToken = true
          if (session.refresh_token) checkpoints.refreshToken = true
          console.log("✅ Session info:", {
            accessToken: !!session.access_token,
            refreshToken: !!session.refresh_token,
            userId: session.user?.id
          })

          if (session.user) {
            const profile = await queryClient.fetchQuery({
              queryKey: queryKeys.userProfile(session.user.id),
              queryFn: () => fetchUserProfile(session.user.id),
              staleTime: Infinity,
              gcTime: Infinity,
            })

            if (profile) checkpoints.profile = true
            if (profile?.is_active) {
              checkpoints.activeFlag = true
              setUserAndCache(profile)
              console.log("✅ User is active and set in state")
            } else {
              console.warn("⚠️ User inactive, signing out")
              await supabase.auth.signOut()
              setUserAndCache(null)
            }
          }
        } else {
          console.log("ℹ️ No session found")
          await supabase.auth.signOut()
          setUserAndCache(null)
        }
      } catch (err) {
        console.error("❌ Error during init:", err)
        await supabase.auth.signOut()
        setUserAndCache(null)
      } finally {
        console.log("📊 Init checkpoints:", checkpoints)
        const obtained = Object.values(checkpoints).filter(Boolean).length
        const total = Object.keys(checkpoints).length
        console.log(`📊 Progress: ${obtained}/${total} info items obtained.`)
        for (const [key, value] of Object.entries(checkpoints)) {
          console.log(`   - ${key}: ${value ? "✅ success" : "❌ failed"}`)
        }
        console.log("✅ Auth init finished")
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
            setUserAndCache(profile)
            console.log("✅ User updated after state change:", profile)
          } else {
            console.warn("⚠️ User inactive on state change, signing out")
            await supabase.auth.signOut()
            setUserAndCache(null)
          }
        } catch (err) {
          console.error("❌ Failed to refresh profile on state change:", err)
        }
      } else {
        if (user?.id) {
          queryClient.removeQueries({ queryKey: queryKeys.userProfile(user.id) })
        }
        setUserAndCache(null)
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

        setUserAndCache(profile)
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
    setUserAndCache(null)
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
          setUserAndCache(null)
          await supabase.auth.signOut()
          return
        }
        setUserAndCache(profile)
        clearPermissionCache()
        resetInactivityTimer()
        console.log("✅ User profile refreshed")
      } else {
        console.warn("⚠️ No session user on refresh, clearing state")
        setUserAndCache(null)
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
