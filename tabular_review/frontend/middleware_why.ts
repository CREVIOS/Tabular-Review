// import { NextRequest, NextResponse } from 'next/server'
// import { createClient } from '@supabase/supabase-js'

// // Define route patterns
// const PUBLIC_ROUTES = [
//   '/login',
//   '/register'
// ]

// const API_ROUTES = [
//   '/api/'
// ]

// const PROTECTED_ROUTES = [
//   '/',
//   '/documents',
//   '/review',
//   '/upload'
// ]

// // Create Supabase client for middleware
// function createMiddlewareSupabaseClient(request: NextRequest) {
//   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
//   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
//   return createClient(supabaseUrl, supabaseAnonKey, {
//     auth: {
//       autoRefreshToken: false,
//       persistSession: false,
//     },
//     global: {
//       headers: {
//         'Authorization': request.headers.get('Authorization') ?? '',
//       }
//     }
//   })
// }

// function isPublicRoute(pathname: string): boolean {
//   return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
// }

// function isApiRoute(pathname: string): boolean {
//   return API_ROUTES.some(route => pathname.startsWith(route))
// }

// function isProtectedRoute(pathname: string): boolean {
//   return PROTECTED_ROUTES.some(route => {
//     if (route === '/') {
//       return pathname === '/'
//     }
//     return pathname.startsWith(route)
//   })
// }

// function addSecurityHeaders(response: NextResponse): NextResponse {
//   // Security headers
//   response.headers.set('X-Frame-Options', 'DENY')
//   response.headers.set('X-Content-Type-Options', 'nosniff')
//   response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
//   response.headers.set('X-XSS-Protection', '1; mode=block')
  
//   // Content Security Policy
//   response.headers.set(
//     'Content-Security-Policy',
//     "default-src 'self'; " +
//     "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
//     "style-src 'self' 'unsafe-inline'; " +
//     "img-src 'self' data: https:; " +
//     "font-src 'self'; " +
//     "connect-src 'self' http://localhost:8000 https://localhost:8000 https://*.supabase.co wss://*.supabase.co; " +
//     "frame-ancestors 'none';"
//   )
  
//   // HSTS (only in production)
//   if (process.env.NODE_ENV === 'production') {
//     response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
//   }
  
//   return response
// }

// function getClientIP(request: NextRequest): string {
//   // Try to get IP from various headers
//   const forwardedFor = request.headers.get('x-forwarded-for')
//   const realIP = request.headers.get('x-real-ip')
//   const clientIP = request.headers.get('x-client-ip')
  
//   if (forwardedFor) {
//     // x-forwarded-for can contain multiple IPs, get the first one
//     return forwardedFor.split(',')[0].trim()
//   }
  
//   if (realIP) {
//     return realIP
//   }
  
//   if (clientIP) {
//     return clientIP
//   }
  
//   // Fallback to unknown if no IP found
//   return 'unknown'
// }

// export async function middleware(request: NextRequest) {
//   const { pathname } = request.nextUrl
//   const response = NextResponse.next()
  
//   // Add security headers to all responses
//   addSecurityHeaders(response)
  
//   console.log(`Middleware processing: ${request.method} ${pathname}`)
  
//   // Handle CORS for API routes
//   if (isApiRoute(pathname)) {
//     // Allow CORS for API routes
//     response.headers.set('Access-Control-Allow-Origin', '*')
//     response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
//     response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
    
//     // Handle preflight requests
//     if (request.method === 'OPTIONS') {
//       return new Response(null, { status: 200, headers: response.headers })
//     }
//   }
  
//   // Skip authentication for static assets
//   if (pathname.startsWith('/_next/') || 
//       pathname.startsWith('/favicon.ico') || 
//       pathname.startsWith('/public/')) {
//     return response
//   }
  
//   // Skip authentication check for public routes
//   if (isPublicRoute(pathname)) {
//     console.log(`Public route accessed: ${pathname}`)
//     return response
//   }
  
//   // Check authentication for protected routes
//   if (isProtectedRoute(pathname)) {
//     try {
//       // Get the access token from various sources
//       const accessToken = request.cookies.get('sb-access-token')?.value || 
//                          request.headers.get('Authorization')?.replace('Bearer ', '') ||
//                          request.cookies.get('supabase-auth-token')?.value
      
//       if (!accessToken) {
//         console.log(`No access token found for protected route: ${pathname}`)
        
//         // For API routes, return 401
//         if (isApiRoute(pathname)) {
//           return NextResponse.json(
//             { error: 'Authentication required', code: 'UNAUTHORIZED' },
//             { status: 401 }
//           )
//         }
        
//         // For page routes, redirect to login
//         const loginUrl = new URL('/login', request.url)
//         loginUrl.searchParams.set('returnTo', pathname)
//         return NextResponse.redirect(loginUrl)
//       }
      
//       // Create Supabase client and verify the session
//       const supabase = createMiddlewareSupabaseClient(request)
//       const { data: { user }, error } = await supabase.auth.getUser(accessToken)
      
//       if (error || !user) {
//         console.log(`Invalid access token for protected route: ${pathname}`, error?.message)
        
//         // For API routes, return 401
//         if (isApiRoute(pathname)) {
//           return NextResponse.json(
//             { error: 'Invalid or expired token', code: 'TOKEN_INVALID' },
//             { status: 401 }
//           )
//         }
        
//         // For page routes, redirect to login and clear invalid token
//         const loginUrl = new URL('/login', request.url)
//         loginUrl.searchParams.set('returnTo', pathname)
//         const redirectResponse = NextResponse.redirect(loginUrl)
        
//         // Clear invalid tokens
//         redirectResponse.cookies.delete('sb-access-token')
//         redirectResponse.cookies.delete('sb-refresh-token')
//         redirectResponse.cookies.delete('supabase-auth-token')
        
//         return redirectResponse
//       }
      
//       // Add user info to request headers for API routes
//       if (isApiRoute(pathname)) {
//         response.headers.set('X-User-ID', user.id)
//         response.headers.set('X-User-Email', user.email || '')
//       }
      
//       console.log(`Authenticated user ${user.email} accessing: ${pathname}`)
      
//     } catch (error) {
//       console.error('Authentication error in middleware:', error)
      
//       // For API routes, return 500
//       if (isApiRoute(pathname)) {
//         return NextResponse.json(
//           { error: 'Authentication service unavailable', code: 'AUTH_ERROR' },
//           { status: 500 }
//         )
//       }
      
//       // For page routes, redirect to login
//       const loginUrl = new URL('/login', request.url)
//       loginUrl.searchParams.set('returnTo', pathname)
//       return NextResponse.redirect(loginUrl)
//     }
//   }
  
//   // Rate limiting for API routes (basic implementation)
//   if (isApiRoute(pathname)) {
//     const ip = getClientIP(request)
    
//     // This is a basic rate limiting - in production, use Redis or similar
//     // For now, we'll just log the request for monitoring
//     console.log(`API request from IP ${ip}: ${request.method} ${pathname}`)
    
//     // Add rate limiting headers
//     response.headers.set('X-RateLimit-Limit', '100')
//     response.headers.set('X-RateLimit-Remaining', '99')
//     response.headers.set('X-RateLimit-Reset', String(Date.now() + 60000))
//   }
  
//   return response
// }

// // Configure which routes the middleware should run on
// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except:
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - public folder
//      */
//     '/((?!_next/static|_next/image|favicon.ico|public/).*)',
//   ],
// } 