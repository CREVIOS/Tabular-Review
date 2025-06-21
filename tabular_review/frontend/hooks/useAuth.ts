import { useCallback } from 'react'

export const useAuth = () => {
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('auth_token')
  }, [])

  const getAuthHeaders = useCallback(() => {
    const token = getAuthToken()
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, [getAuthToken])

  const checkAuth = useCallback(() => {
    const token = getAuthToken()
    if (!token) {
      window.location.href = '/login'
      return false
    }
    return true
  }, [getAuthToken])

  return {
    getAuthToken,
    getAuthHeaders,
    checkAuth
  }
} 