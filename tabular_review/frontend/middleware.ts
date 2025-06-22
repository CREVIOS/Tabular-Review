import { NextRequest, NextResponse } from 'next/server'

// Define route patterns
const PUBLIC_ROUTES = [
  '/login',
  '/register'
]

const PROTECTED_ROUTES = [
  '/',
  '/documents',
  '/review',
  '/upload'
]

// Dashboard route (with parentheses in folder name)
const DASHBOARD_ROUTES = [
  '/dashboard'
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

function isProtectedRoute(pathname: string): boolean {
  // Check regular protected routes
  const isRegularProtected = PROTECTED_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(route)
  })
  
  // Check dashboard routes
  const isDashboardProtected = DASHBOARD_ROUTES.some(route => 
    pathname.startsWith(route)
  )
  
  return isRegularProtected || isDashboardProtected
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    // Call your backend API to verify the token
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    
    return response.ok
  } catch (error) {
    console.error('Token verification failed:', error)
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`Middleware processing: ${request.method} ${pathname}`)
  
  // Skip authentication for static assets and Next.js internals
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') || 
      pathname.startsWith('/public/') ||
      pathname.includes('.')) {
    return NextResponse.next()
  }
  
  // Skip authentication check for public routes
  if (isPublicRoute(pathname)) {
    console.log(`Public route accessed: ${pathname}`)
    return NextResponse.next()
  }
  
  // Check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    try {
      // Get the access token from various sources
      const accessToken = request.cookies.get('auth_token')?.value || 
                         request.headers.get('Authorization')?.replace('Bearer ', '')
      
      if (!accessToken) {
        console.log(`No access token found for protected route: ${pathname}`)
        
        // Redirect to login with return URL
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('returnTo', pathname)
        return NextResponse.redirect(loginUrl)
      }
      
      // Verify the token with the backend
      const isValidToken = await verifyToken(accessToken)
      
      if (!isValidToken) {
        console.log(`Invalid access token for protected route: ${pathname}`)
        
        // Redirect to login and clear invalid token
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('returnTo', pathname)
        const redirectResponse = NextResponse.redirect(loginUrl)
        
        // Clear invalid tokens
        redirectResponse.cookies.delete('auth_token')
        
        return redirectResponse
      }
      
      console.log(`Authenticated user accessing: ${pathname}`)
      
    } catch (error) {
      console.error('Authentication error in middleware:', error)
      
      // Redirect to login on any authentication error
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 