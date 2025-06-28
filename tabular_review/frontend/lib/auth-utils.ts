// Authentication utilities for middleware and client-side use
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

export interface User {
  id: string
  email: string
  full_name?: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  expires_in?: number
  user: User
}

// Convert Supabase user to our User interface
const convertSupabaseUser = (supabaseUser: SupabaseUser): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    full_name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name
  }
}

// Client-side authentication helpers using Supabase
export const clientAuth = {
  // Get current session
  getSession: async (): Promise<Session | null> => {
    try {
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        return null
      }
      return session
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  },

  // Get token from Supabase session
  getToken: async (): Promise<string | null> => {
    try {
      const session = await clientAuth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Failed to get token:', error)
      return null
    }
  },

  // Get current user data from Supabase
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return null
      }
      return convertSupabaseUser(user)
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  // Check if user is authenticated
  isAuthenticated: async (): Promise<boolean> => {
    try {
      const session = await clientAuth.getSession()
      return !!session
    } catch (error) {
      console.error('Error checking authentication:', error)
      return false
    }
  },

  // Sign out user
  signOut: async (): Promise<void> => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  },

  // Refresh session
  refreshSession: async (): Promise<Session | null> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.refreshSession()
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
}

// Route configuration
export const routeConfig = {
  PUBLIC_ROUTES: [
    '/',
    '/login',
    '/register',
    '/api/auth/login',
    '/api/auth/register',
  ],
  
  PROTECTED_ROUTES: [
    '/documents',
    '/review',
    '/upload',
    '/api/files',
    '/api/folders',
    '/api/reviews',
  ],
  
  isPublicRoute: (pathname: string): boolean => {
    return routeConfig.PUBLIC_ROUTES.some(route => {
      if (route === '/') {
        return pathname === '/'
      }
      return pathname.startsWith(route)
    })
  },
  
  isProtectedRoute: (pathname: string): boolean => {
    return routeConfig.PROTECTED_ROUTES.some(route => 
      pathname.startsWith(route)
    )
  }
}

// Security headers configuration
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    // "connect-src 'self' http://localhost:8000 https://localhost:8000",
    "frame-ancestors 'none'"
  ].join('; ')
}

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.'
} 