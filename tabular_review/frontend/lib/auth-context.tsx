"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

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

// Convert Supabase user to our User interface
const convertSupabaseUser = (supabaseUser: SupabaseUser): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    full_name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name,
    is_active: true, // Supabase users are active by default
    created_at: supabaseUser.created_at,
    last_login: supabaseUser.last_sign_in_at || undefined
  }
}

// Supabase session management
class SupabaseSessionManager {
  private static supabase = createClient()

  static async getSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        return null
      }
      return session
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  }

  static async getUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser()
      if (error || !user) {
        return null
      }
      return convertSupabaseUser(user)
    } catch (error) {
      console.error('Failed to get user:', error)
      return null
    }
  }

  static async signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data.user || !data.session) {
      throw new Error('Login failed - no user or session returned')
    }

    return {
      user: convertSupabaseUser(data.user),
      session: data.session
    }
  }

  static async signUp(email: string, password: string, fullName?: string): Promise<{ user: User; session: Session }> {
    console.log('SupabaseSessionManager: Attempting sign up for:', email)
    
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })

    console.log('SupabaseSessionManager: Sign up response:', {
      hasUser: !!data.user,
      hasSession: !!data.session,
      userEmail: data.user?.email,
      userConfirmed: data.user?.email_confirmed_at ? 'confirmed' : 'pending',
      error: error?.message
    })

    if (error) {
      console.error('SupabaseSessionManager: Sign up error:', error)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Registration failed - no user returned')
    }

    // Convert the user
    const user = convertSupabaseUser(data.user)

    // Handle email confirmation flow
    if (!data.session) {
      console.log('SupabaseSessionManager: Email confirmation required for:', email)
      // Return user but no session - this indicates email confirmation is needed
      // We'll create a minimal session object to satisfy the type, but it won't be used
      const placeholderSession: Session = {
        access_token: '',
        refresh_token: '',
        expires_in: 0,
        expires_at: 0,
        token_type: 'bearer',
        user: data.user
      }
      return { user, session: placeholderSession }
    }

    console.log('SupabaseSessionManager: Immediate session created for:', email)
    return {
      user,
      session: data.session
    }
  }

  static async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  static async refreshSession(): Promise<Session | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession()
      if (error) {
        console.error('Error refreshing session:', error)
        return null
      }
      return data.session
    } catch (error) {
      console.error('Failed to refresh session:', error)
      return null
    }
  }

  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
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
    setAuthState(prev => ({ ...prev, lastActivity: now }))
  }, [])

  // Validate session - more resilient version
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const session = await SupabaseSessionManager.getSession()
      if (!session) {
        return false
      }

      const user = await SupabaseSessionManager.getUser()
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          lastActivity: new Date(),
          sessionExpiry: session.expires_at ? new Date(session.expires_at) : null
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Session validation failed:', error)
      return false
    }
  }, [])

  // Check authentication status
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await validateSession()
      if (!isValid) {
        await SupabaseSessionManager.signOut()
        return false
      }

      return true
    } catch (error) {
      console.error('Auth check failed:', error)
      return false
    }
  }, [validateSession])

  // Logout function
  const logout = useCallback(async () => {
    try {
      await SupabaseSessionManager.signOut()
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        lastActivity: null,
        sessionExpiry: null
      })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [router])

  // Refresh authentication - with fallback for missing endpoint
  const refreshAuth = useCallback(async () => {
    try {
      const session = await SupabaseSessionManager.refreshSession()
      if (session) {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          lastActivity: new Date(),
          sessionExpiry: session.expires_at ? new Date(session.expires_at) : null
        }))
      } else {
        console.warn('Token refresh endpoint not available')
      }
    } catch (error: unknown) {
      console.error('Token refresh failed:', error)
      logout()
    }
  }, [logout])

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { user, session } = await SupabaseSessionManager.signIn(email, password)
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: new Date(),
        sessionExpiry: session.expires_at ? new Date(session.expires_at) : null
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
      console.log('Auth Context: Starting registration process...')
      
      const { user, session } = await SupabaseSessionManager.signUp(email, password, fullName)
      
      console.log('Auth Context: Registration response:', { 
        hasUser: !!user, 
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userEmail: user?.email,
        emailConfirmed: session?.access_token ? 'session_exists' : 'email_confirmation_required'
      })
      
      // Handle Supabase email confirmation flow
      // Check for access_token instead of session existence since we return a placeholder
      if (!session?.access_token) {
        // Email confirmation required - this is normal for Supabase
        console.log('Auth Context: Email confirmation required - not setting auth state yet')
        // Don't set auth state until email is confirmed
        // The user will need to click the email link and then sign in
        return
      }
      
      // If we have a real session with access token, set the auth state (immediate confirmation case)
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: new Date(),
        sessionExpiry: session.expires_at ? new Date(session.expires_at) : null
      })
      
      console.log('Auth Context: Registration complete with immediate session')
      router.push('/')
      
    } catch (error) {
      console.error('Auth Context: Registration failed:', error)
      
      // Enhanced error handling
      if (error instanceof Error) {
        // Handle specific Supabase registration errors
        if (error.message?.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        } else if (error.message?.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.')
        } else if (error.message?.includes('Password should be at least')) {
          throw new Error('Password does not meet security requirements. Please choose a stronger password.')
        } else if (error.message?.includes('Signup not allowed')) {
          throw new Error('Registration is currently disabled. Please contact support.')
        }
      }
      
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