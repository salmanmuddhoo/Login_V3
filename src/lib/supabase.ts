import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

/**
 * Get the current access token safely.
 * If the session is expired or missing, returns null instead of throwing.
 */
export const getAccessToken = async (): Promise<string | null> => {
  console.log('🔑 Supabase: Getting access token...')
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    console.log('📊 Supabase: Session check result:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
      isExpired: session?.expires_at ? Date.now() > session.expires_at * 1000 : 'Unknown'
    })
    if (session?.access_token) return session.access_token

    console.log('⚠️ Supabase: No access token available')
    return null
  } catch (err) {
    console.error('❌ Supabase: Error getting access token:', err)
    return null
  }
}

// Helper function to get auth headers for API calls
export const getAuthHeaders = async () => {
  const token = await getAccessToken()
  if (!token) throw new Error('No active session. Please log in again.')

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}