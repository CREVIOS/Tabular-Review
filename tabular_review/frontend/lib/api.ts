import axios from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { createClient } from '@/lib/supabase/client'

// Get the appropriate API base URL
const getApiBaseUrl = () => {
  // Check if we're running in a browser
  if (typeof window !== 'undefined') {
    // In production, use relative URLs
    if (process.env.NODE_ENV === 'production') {
      return ''  // Empty string for relative URLs
    }
    
    // In development, check if we're in Docker
    if (window.location.hostname === 'frontend') {
      return 'http://backend:8000'
    }
    
    // Default to localhost for local development
    return 'http://localhost:8000'
  }
  
  // Server-side rendering - use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

// Use the dynamic API base URL
const API_BASE_URL = getApiBaseUrl()

console.log('API_BASE_URL:', API_BASE_URL)

// Security configuration
const SECURITY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  REQUEST_TIMEOUT: 30000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 100,
  SENSITIVE_ENDPOINTS: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'],
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'https://localhost:3000',
    process.env.NEXT_PUBLIC_APP_URL
  ].filter(Boolean)
}

// Request rate limiting
class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  isAllowed(endpoint: string): boolean {
    const now = Date.now()
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW
    
    if (!this.requests.has(endpoint)) {
      this.requests.set(endpoint, [])
    }
    
    const endpointRequests = this.requests.get(endpoint)!
    
    // Remove old requests outside the window
    const recentRequests = endpointRequests.filter(time => time > windowStart)
    this.requests.set(endpoint, recentRequests)
    
    // Check if limit exceeded
    if (recentRequests.length >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
      return false
    }
    
    // Add current request
    recentRequests.push(now)
    return true
  }

  getRemainingRequests(endpoint: string): number {
    const requests = this.requests.get(endpoint) || []
    const now = Date.now()
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW
    const recentRequests = requests.filter(time => time > windowStart)
    
    return Math.max(0, SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW - recentRequests.length)
  }
}

const rateLimiter = new RateLimiter()

// Input sanitization
const sanitizeInput = (data: unknown): unknown => {
  if (typeof data === 'string') {
    // Basic XSS prevention
    return data
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput)
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      // Sanitize keys too
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '')
      sanitized[cleanKey] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return data
}

// Security headers configuration
const getSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http://localhost:8000 https://localhost:8000 http://backend:8000 https://backend:8000 ws://localhost:8000 wss://localhost:8000 ws://backend:8000 wss://backend:8000;",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
})

// Create a single axios instance with enhanced security
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: SECURITY_CONFIG.REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    ...getSecurityHeaders()
  },
  withCredentials: false, // Only set to true if using cookies for auth
})

// Request interceptor with security enhancements
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window === 'undefined') {
      return config
    }

    // Rate limiting check
    const endpoint = config.url || ''
    if (!rateLimiter.isAllowed(endpoint)) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Ensure headers object exists
    config.headers = config.headers || {}

    // Add CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }

    // Add request ID for tracking
    config.headers['X-Request-ID'] = crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9)

    // Add timestamp
    config.headers['X-Timestamp'] = Date.now().toString()

    // Get Supabase session token
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (error) {
      console.warn('Failed to get Supabase session token:', error)
    }

    // Sanitize request data
    if (config.data) {
      config.data = sanitizeInput(config.data)
    }

    // Log sensitive requests (in development only)
    if (process.env.NODE_ENV === 'development' && SECURITY_CONFIG.SENSITIVE_ENDPOINTS.some(ep => endpoint.includes(ep))) {
      console.log('Secure API request:', {
        method: config.method?.toUpperCase(),
        url: endpoint,
        timestamp: new Date().toISOString(),
        hasAuth: !!config.headers.Authorization
      })
    }
    
    return config
  },
  (error) => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor with enhanced security
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Validate response structure
    if (response.data && typeof response.data === 'string') {
      try {
        response.data = JSON.parse(response.data)
      } catch {
        // Response is already a string, keep as is
      }
    }

    // Log successful sensitive requests
    if (process.env.NODE_ENV === 'development') {
      const endpoint = response.config.url || ''
      if (SECURITY_CONFIG.SENSITIVE_ENDPOINTS.some(ep => endpoint.includes(ep))) {
        console.log('Secure API response:', {
          status: response.status,
          url: endpoint,
          timestamp: new Date().toISOString()
        })
      }
    }

    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const errorData = error.response?.data as Record<string, unknown>
    const endpoint = error.config?.url || ''
    
    // Enhanced error logging
    console.error('API Security Error:', {
      status,
      endpoint,
      message: errorData?.detail || error.message,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      requestId: error.config?.headers?.['X-Request-ID']
    })

    // Handle authentication errors
    if (status === 401 || status === 403) {
      if (typeof window !== 'undefined') {
        // Clear any auth cookies
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        
        // Store current location for redirect after login
        const currentPath = window.location.pathname
        if (currentPath !== '/login' && currentPath !== '/register') {
          sessionStorage.setItem('returnTo', currentPath)
        }
        
        // Redirect to login
        window.location.href = '/login'
      }
    }

    // Handle rate limiting
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      const message = retryAfter 
        ? `Rate limited. Please try again in ${retryAfter} seconds.`
        : 'Too many requests. Please try again later.'
      
      return Promise.reject(new Error(message))
    }

    // Handle server errors with user-friendly messages
    if (status === 500) {
      const userMessage = 'Server error occurred. Our team has been notified.'
      
      // Log detailed error for development
      if (process.env.NODE_ENV === 'development') {
      console.error('Server Error Details:', {
        message: errorData?.detail || 'Internal server error',
          endpoint,
          timestamp: new Date().toISOString(),
          stack: errorData?.stack
      })
      }
      
      return Promise.reject(new Error(userMessage))
    }

    return Promise.reject(error)
  }
)

// Enhanced authentication helpers with security
export const auth = {
  // Note: Authentication is now handled by Supabase
  // These methods are kept for compatibility but delegate to Supabase
  
  login: async (email: string, password: string) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email format')
      }

      // Use Supabase for authentication
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim()
      })

      if (error) {
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  register: async (email: string, password: string, full_name?: string) => {
    try {
      // Enhanced validation
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email format')
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }

      // Password strength check
      const hasUpper = /[A-Z]/.test(password)
      const hasLower = /[a-z]/.test(password)
      const hasNumber = /\d/.test(password)
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
      
      if (!(hasUpper && hasLower && hasNumber && hasSpecial)) {
        throw new Error('Password must contain uppercase, lowercase, number, and special character')
      }

      // Use Supabase for registration
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: {
            full_name: full_name?.trim()
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  },

  logout: async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      
      if (typeof window !== 'undefined') {
        // Clear any auth cookies
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
        
        // Clear return URL
        sessionStorage.removeItem('returnTo')
        
        console.log('User logged out successfully')
        
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if logout fails
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  },

  getCurrentUser: async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Error getting current user:', error)
        return null
      }
      
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  isAuthenticated: async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      return !!session
    } catch (error) {
      console.error('Error checking authentication:', error)
      return false
    }
  },

  refreshToken: async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw error
    }
  }
}

// Enhanced files endpoints with security
export const files = {
  upload: async (files: File[], folderId?: string | null) => {
    try {
      if (!files || files.length === 0) {
        throw new Error('No files provided for upload')
      }
      
      console.log('Starting file upload:', files.map(f => ({ name: f.name, type: f.type, size: f.size })))
      console.log('Target folder:', folderId)
      
      // Validate files
      const maxSize = 50 * 1024 * 1024 // 50MB
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Maximum size is 50MB.`)
        }
        
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} has unsupported type. Please upload PDF, Word, Excel, or text files.`)
        }
        
        // Check filename for malicious patterns
        const dangerousPatterns = [/\.exe$/i, /\.bat$/i, /\.sh$/i, /\.php$/i, /\.js$/i]
        if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
          throw new Error(`File ${file.name} has a potentially dangerous extension.`)
        }
      }
      
      const formData = new FormData()
      files.forEach((file) => {
        console.log(`Appending file: ${file.name} (${file.type}, ${file.size} bytes)`)
        formData.append('files', file)
      })
      
      // Add folder_id if provided
      if (folderId) {
        formData.append('folder_id', folderId)
        console.log('Added folder_id to form data:', folderId)
      }
      
      // Check if we have auth token
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.')
      }
      console.log('Upload auth token available:', !!token)
      
      // Log the form data keys to help with debugging
      const formDataKeys: string[] = []
      formData.forEach((_, key) => {
        formDataKeys.push(key)
      })
      console.log('Form data keys:', formDataKeys)
      
      // Use fetch instead of axios for better compatibility with FastAPI's manual form parsing
      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let browser set it with boundary
        },
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }
      
      const result = await response.json()
      console.log('Upload successful:', result)
      return result
      
    } catch (error) {
      console.error('File upload error:', error)
      throw error
    }
  },

  getFiles: async () => {
    try {
      const response = await api.get('/api/files/')
      return response.data || []
    } catch (error) {
      console.error('Get files error:', error)
      return []
    }
  },

  getMarkdown: async (fileId: string) => {
    try {
      // Validate fileId format
      if (!/^[a-zA-Z0-9-_]+$/.test(fileId)) {
        throw new Error('Invalid file ID format')
      }
      
      const response = await api.get(`/api/files/${fileId}/markdown`)
      return response.data
    } catch (error) {
      console.error('Get markdown error:', error)
      throw error
    }
  },

  deleteFile: async (fileId: string) => {
    try {
      if (!/^[a-zA-Z0-9-_]+$/.test(fileId)) {
        throw new Error('Invalid file ID format')
      }
      
      const response = await api.delete(`/api/files/${fileId}`)
      return response.data
    } catch (error) {
      console.error('Delete file error:', error)
      throw error
    }
  }
}

// Security utilities
export const security = {
  // Generate secure random string
  generateSecureId: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  },

  // Check if request is from allowed origin
  isAllowedOrigin: (origin: string): boolean => {
    return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin)
  },

  // Get remaining rate limit for endpoint
  getRateLimit: (endpoint: string): number => {
    return rateLimiter.getRemainingRequests(endpoint)
  },

  // Validate JWT token format (basic check)
  isValidTokenFormat: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false
    
    // JWT should have 3 parts separated by dots
    const parts = token.split('.')
    return parts.length === 3 && parts.every(part => part.length > 0)
  }
}

// Health check with security validation
export const healthCheck = async () => {
  try {
    const response = await api.get('/api/health', { timeout: 5000 })
    return response.status === 200
  } catch (error) {
    console.error('Health check failed:', error)
    return false
  }
}

// Enhanced error handling with security considerations
export const handleApiError = (error: unknown): string => {
  // Don't expose sensitive information in error messages
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status
    const data = error.response.data as Record<string, unknown>
    
    switch (status) {
      case 400:
        return typeof data?.message === 'string' ? data.message : 'Invalid request. Please check your input.'
      case 401:
        return 'Authentication required. Please log in again.'
      case 403:
        return 'Access denied. You don\'t have permission for this action.'
      case 404:
        return 'The requested resource was not found.'
      case 413:
        return 'File too large. Please upload a smaller file.'
      case 429:
        return 'Too many requests. Please wait before trying again.'
      case 500:
        return 'A server error occurred. Please try again later.'
      case 503:
        return 'Service temporarily unavailable. Please try again later.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  } else if (axios.isAxiosError(error) && error.request) {
    return 'Network error. Please check your internet connection.'
  } else {
    // Filter out potentially sensitive information
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    
    // Don't expose internal paths, tokens, or technical details
    const sensitivePatterns = [
      /Bearer\s+[^\s]+/gi,
      /token[:\s=]+[^\s]+/gi,
      /password[:\s=]+[^\s]+/gi,
      /\/[a-z]:\\/gi, // Windows paths
      /\/home\/[^\s]+/gi, // Unix paths
    ]
    
    let cleanMessage = message
    sensitivePatterns.forEach(pattern => {
      cleanMessage = cleanMessage.replace(pattern, '[REDACTED]')
    })
    
    return cleanMessage
  }
}

export default api