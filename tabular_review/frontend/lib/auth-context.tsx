"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { auth, api } from './api'

// Types
interface User {
  id: string
  email: string
  full_name?: string
  is_active?: boolean
  created_at: string
  last_login?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  lastActivity: Date | null
  sessionExpiry: Date | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<boolean>
  refreshAuth: () => Promise<void>
  updateActivity: () => void
}

// Security configuration
const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  ACTIVITY_CHECK_INTERVAL: 60 * 1000, // 1 minute
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  MAX_IDLE_TIME: 15 * 60 * 1000, // 15 minutes
  PROTECTED_ROUTES: [
    '/',
    '/dashboard',
    '/documents',
    '/upload',
    '/review',
    '/settings'
  ],
  PUBLIC_ROUTES: [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ]
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Secure token management
class SecureTokenManager {
  private static readonly TOKEN_KEY = 'auth_token'
  private static readonly USER_KEY = 'user_data'
  private static readonly EXPIRY_KEY = 'token_expiry'
  private static readonly ACTIVITY_KEY = 'last_activity'

  static setToken(token: string, expiresIn: number = 86400): void {
    if (typeof window === 'undefined') return
    
    try {
      const expiry = new Date(Date.now() + (expiresIn * 1000))
      
      localStorage.setItem(this.TOKEN_KEY, token)
      localStorage.setItem(this.EXPIRY_KEY, expiry.toISOString())
      localStorage.setItem(this.ACTIVITY_KEY, new Date().toISOString())
      
      // Set secure cookie for production (HTTPS) or any cookie for development
      const isProduction = process.env.NODE_ENV === 'production'
      const isHttps = window.location.protocol === 'https:'
      
      if (isHttps || !isProduction) {
        const cookieOptions = isHttps 
          ? `${this.TOKEN_KEY}=${token}; path=/; secure; samesite=strict; max-age=${expiresIn}`
          : `${this.TOKEN_KEY}=${token}; path=/; samesite=strict; max-age=${expiresIn}`
        
        document.cookie = cookieOptions
      }
    } catch (error) {
      console.error('Failed to store token:', error)
    }
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null
    
    try {
      const token = localStorage.getItem(this.TOKEN_KEY)
      const expiry = localStorage.getItem(this.EXPIRY_KEY)
      
      if (!token || !expiry) return null
      
      if (new Date() > new Date(expiry)) {
        this.clearToken()
        return null
      }
      
      return token
    } catch (error) {
      console.error('Failed to retrieve token:', error)
      return null
    }
  }

  static isTokenValid(): boolean {
    const token = this.getToken()
    return !!token
  }

  static getTokenExpiry(): Date | null {
    if (typeof window === 'undefined') return null
    
    try {
      const expiry = localStorage.getItem(this.EXPIRY_KEY)
      return expiry ? new Date(expiry) : null
    } catch (error) {
      return error instanceof Error ? null : null
    }
  }

  static clearToken(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(this.TOKEN_KEY)
      localStorage.removeItem(this.USER_KEY)
      localStorage.removeItem(this.EXPIRY_KEY)
      localStorage.removeItem(this.ACTIVITY_KEY)
      
      // Clear cookie
      document.cookie = `${this.TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    } catch (error) {
      console.error('Failed to clear token:', error)
    }
  }

  static updateActivity(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.ACTIVITY_KEY, new Date().toISOString())
    } catch (error) {
      console.error('Failed to update activity:', error)
    }
  }

  static getLastActivity(): Date | null {
    if (typeof window === 'undefined') return null
    
    try {
      const activity = localStorage.getItem(this.ACTIVITY_KEY)
      return activity ? new Date(activity) : null
    } catch (error) {
      return error instanceof Error ? null : null
    }
  }

  static setUser(user: User): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user))
    } catch (error) {
      console.error('Failed to store user data:', error)
    }
  }

  static getUser(): User | null {
    if (typeof window === 'undefined') return null
    
    try {
      const userData = localStorage.getItem(this.USER_KEY)
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      console.error('Failed to retrieve user data:', error)
      return null
    }
  }
}

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    lastActivity: null,
    sessionExpiry: null
  })

  // Check if current route is protected
  const isProtectedRoute = useCallback((path: string): boolean => {
    return SECURITY_CONFIG.PROTECTED_ROUTES.some(route => 
      route === '/' ? path === '/' : path.startsWith(route)
    )
  }, [])

  // Check if current route is public
  const isPublicRoute = useCallback((path: string): boolean => {
    return SECURITY_CONFIG.PUBLIC_ROUTES.some(route => path.startsWith(route))
  }, [])

  // Update user activity
  const updateActivity = useCallback(() => {
    const now = new Date()
    SecureTokenManager.updateActivity()
    setAuthState(prev => ({ ...prev, lastActivity: now }))
  }, [])

  // Validate session - more resilient version
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      if (!SecureTokenManager.isTokenValid()) {
        return false
      }

      const lastActivity = SecureTokenManager.getLastActivity()
      if (lastActivity) {
        const timeSinceActivity = Date.now() - lastActivity.getTime()
        if (timeSinceActivity > SECURITY_CONFIG.MAX_IDLE_TIME) {
          console.log('Session expired due to inactivity')
          return false
        }
      }

      // Try to verify token with server, but don't fail if endpoint doesn't exist
      try {
        const response = await api.get('/api/auth/verify')
        return response.status === 200
      } catch (error: unknown) {
        // If the verify endpoint doesn't exist (404), but we have a valid token locally, continue
        if (error && typeof error === 'object' && 'response' in error && 
            error.response && typeof error.response === 'object' && 'status' in error.response && 
            error.response.status === 404) {
          console.warn('Token verification endpoint not available, using local validation')
          return true // Continue with local token validation
        }
        console.error('Session validation failed:', error)
        return false
      }
    } catch (error) {
      console.error('Session validation failed:', error)
      return false
    }
  }, [])

  // Check authentication status
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const token = SecureTokenManager.getToken()
      if (!token) {
        return false
      }

      const isValid = await validateSession()
      if (!isValid) {
        SecureTokenManager.clearToken()
        return false
      }

      const user = SecureTokenManager.getUser()
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          lastActivity: SecureTokenManager.getLastActivity(),
          sessionExpiry: SecureTokenManager.getTokenExpiry()
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Auth check failed:', error)
      return false
    }
  }, [validateSession])

    // Logout function - graceful handling of missing endpoint
  const logout = useCallback(() => {
    try {
      // Try to call logout API, but don't fail if it doesn't exist
      api.post('/api/auth/logout').catch(err => {
        // Only log error if it's not a 404 (missing endpoint)
        if (err.response?.status !== 404) {
          console.error('Logout API call failed:', err)
        }
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      SecureTokenManager.clearToken()
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        lastActivity: null,
        sessionExpiry: null
      })
      router.push('/login')
    }
  }, [router])

  // Refresh authentication - with fallback for missing endpoint
  const refreshAuth = useCallback(async () => {
    try {
      const response = await api.post('/api/auth/refresh')
      const { access_token, user, expires_in } = response.data
      
      SecureTokenManager.setToken(access_token, expires_in)
      SecureTokenManager.setUser(user)
      
      setAuthState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
        lastActivity: new Date(),
        sessionExpiry: SecureTokenManager.getTokenExpiry()
      }))
    } catch (error: unknown) {
      console.error('Token refresh failed:', error)
      // If refresh endpoint doesn't exist, just log the user out
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 'status' in error.response &&
          error.response.status === 404) {
        console.warn('Token refresh endpoint not available')
      }
      logout()
    }
  }, [logout])

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await auth.login(email, password)
      const { access_token, user, expires_in = 86400 } = response
      
      SecureTokenManager.setToken(access_token, expires_in)
      SecureTokenManager.setUser(user)
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: new Date(),
        sessionExpiry: SecureTokenManager.getTokenExpiry()
      })
      
      // Redirect to intended page or dashboard
      const returnTo = sessionStorage.getItem('returnTo') || '/'
      sessionStorage.removeItem('returnTo')
      router.push(returnTo)
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }, [router])

  // Register function
  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      const response = await auth.register(email, password, fullName)
      const { access_token, user, expires_in = 86400 } = response
      
      SecureTokenManager.setToken(access_token, expires_in)
      SecureTokenManager.setUser(user)
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: new Date(),
        sessionExpiry: SecureTokenManager.getTokenExpiry()
      })
      
      router.push('/')
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }, [router])

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true }))
        
        const isAuthenticated = await checkAuth()
        
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated
        }))
      } catch (error) {
        console.error('Auth initialization failed:', error)
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false
        }))
      }
    }

    initAuth()
  }, [checkAuth])

  // Route protection
  useEffect(() => {
    if (authState.isLoading) return

    const currentPath = pathname || '/'

    // Redirect authenticated users away from public routes
    if (authState.isAuthenticated && isPublicRoute(currentPath)) {
      router.push('/')
      return
    }

    // Redirect unauthenticated users away from protected routes
    if (!authState.isAuthenticated && isProtectedRoute(currentPath)) {
      // Store intended destination
      sessionStorage.setItem('returnTo', currentPath)
      router.push('/login')
      return
    }
  }, [authState.isAuthenticated, authState.isLoading, pathname, router, isProtectedRoute, isPublicRoute])

  // Activity tracking
  useEffect(() => {
    if (!authState.isAuthenticated) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    
    const handleActivity = () => {
      updateActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
    }
  }, [authState.isAuthenticated, updateActivity])

  // Session monitoring - reduced frequency to avoid overwhelming missing endpoints
  useEffect(() => {
    if (!authState.isAuthenticated) return

    const interval = setInterval(async () => {
      try {
        const isValid = await validateSession()
        if (!isValid) {
          logout()
        }
      } catch (error) {
        console.error('Session monitoring error:', error)
        // Don't auto-logout on monitoring errors, just log them
      }
    }, SECURITY_CONFIG.ACTIVITY_CHECK_INTERVAL * 2) // Reduce frequency

    return () => clearInterval(interval)
  }, [authState.isAuthenticated, validateSession, logout])

  // Token refresh - only if refresh endpoint is available
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.sessionExpiry) return

    const checkTokenRefresh = () => {
      const now = Date.now()
      const expiry = authState.sessionExpiry!.getTime()
      const timeUntilExpiry = expiry - now

      if (timeUntilExpiry < SECURITY_CONFIG.TOKEN_REFRESH_THRESHOLD) {
        refreshAuth()
      }
    }

    const interval = setInterval(checkTokenRefresh, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [authState.isAuthenticated, authState.sessionExpiry, refreshAuth])

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    checkAuth,
    refreshAuth,
    updateActivity
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
} 