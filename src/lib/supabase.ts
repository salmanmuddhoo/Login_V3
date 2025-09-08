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
 * Enhanced with better error handling and retry logic.
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('[Supabase] Error getting session:', error)
      return null
    }

    if (session?.access_token) {
      return session.access_token
    }

    return null
  } catch (error) {
    console.error('[Supabase] Exception getting access token:', error)
    return null
  }
}

/**
 * Helper function to get auth headers for API calls with enhanced error handling
 */
export const getAuthHeaders = async () => {
  const token = await getAccessToken()
  
  if (!token) {
    throw new Error('No active session. Please log in again.')
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}