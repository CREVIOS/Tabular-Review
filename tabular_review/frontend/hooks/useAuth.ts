import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export const useAuth = () => {
  const getAuthToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken()
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, [getAuthToken])

  const checkAuth = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      window.location.href = '/login'
      return false
    }
    return true
  }, [getAuthToken])

  const getCurrentSession = useCallback(async () => {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  }, [])

  return {
    getAuthToken,
    getAuthHeaders,
    checkAuth,
    getCurrentSession
  }
} 