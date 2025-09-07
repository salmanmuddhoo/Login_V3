import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface AuthContextType {
  user: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<any>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile helper
  const fetchUserProfile = async (id: string) => {
    console.log("Fetching user profile for:", id)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error fetching user profile:", error.message)
      return null
    }
    console.log("User profile loaded:", data)
    return data
  }

  // Refresh user manually
  const refreshUser = async () => {
    console.log("Refreshing user...")
    setLoading(true)
    try {
      const { data: { user: sessionUser }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (sessionUser) {
        const profile = await fetchUserProfile(sessionUser.id)
        setUser(profile ? { ...sessionUser, ...profile } : sessionUser)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error("Error refreshing user:", err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Auth state initializer
  useEffect(() => {
    const init = async () => {
      console.log("Auth init starting...")
      setLoading(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log("Initial Supabase session:", session, sessionError)

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          setUser(profile ? { ...session.user, ...profile } : session.user)
        }
      } catch (err) {
        console.error("Error during auth init:", err)
        setUser(null)
      } finally {
        console.log("Auth init done")
        setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session)
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        setUser(profile ? { ...session.user, ...profile } : session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id)
        setUser(profile ? { ...data.user, ...profile } : data.user)
      }
      return data
    } catch (err) {
      console.error("Sign in error:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (err) {
      console.error("Sign out error:", err)
    } finally {
      setLoading(false)
    }
  }

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      return data
    } catch (err) {
      console.error("Password reset error:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, sendPasswordResetEmail, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}