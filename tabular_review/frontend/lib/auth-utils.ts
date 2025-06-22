// Authentication utilities for middleware and client-side use

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

// Client-side authentication helpers
export const clientAuth = {
  // Get token from localStorage
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  },

  // Set token in localStorage
  setToken: (token: string, expiresIn?: number): void => {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('auth_token', token)
    
    if (expiresIn) {
      const expiry = new Date(Date.now() + (expiresIn * 1000))
      localStorage.setItem('token_expiry', expiry.toISOString())
    }
    
    localStorage.setItem('last_activity', new Date().toISOString())
  },

  // Remove token from localStorage
  removeToken: (): void => {
    if (typeof window === 'undefined') return
    
    const keysToRemove = [
      'auth_token',
      'user_data',
      'token_expiry',
      'last_activity'
    ]
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
  },

  // Check if token is expired
  isTokenExpired: (): boolean => {
    if (typeof window === 'undefined') return true
    
    const expiry = localStorage.getItem('token_expiry')
    if (!expiry) return false
    
    return new Date() > new Date(expiry)
  },

  // Get current user data
  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null
    
    try {
      const userData = localStorage.getItem('user_data')
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      console.error('Error parsing user data:', error)
      return null
    }
  },

  // Set current user data
  setCurrentUser: (user: User): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem('user_data', JSON.stringify(user))
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false
    
    const token = clientAuth.getToken()
    if (!token) return false
    
    if (clientAuth.isTokenExpired()) {
      clientAuth.removeToken()
      return false
    }
    
    return true
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
    "connect-src 'self' http://localhost:8000 https://localhost:8000",
    "frame-ancestors 'none'"
  ].join('; ')
}

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.'
} 