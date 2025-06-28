import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware";

// Only define public routes - everything else is protected by default
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password'
];

function isPublicRoute(pathname: string): boolean {
  // Handle root path specifically
  if (pathname === '/') {
    return true;
  }
  
  const cleanPath = pathname.replace(/\/$/, "").toLowerCase();
  return PUBLIC_ROUTES.some(route => {
    // Skip root route in this loop since we handled it above
    if (route === '/') return false;
    
    const cleanRoute = route.replace(/\/$/, "").toLowerCase();
    return cleanPath === cleanRoute || cleanPath.startsWith(cleanRoute + "/");
  });
}

function createRedirect(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    pathname === "/site.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Debug logging
  console.log(`[Middleware] Processing: ${pathname}`);

  // Update Supabase session and get user info
  const { supabaseResponse, user } = await updateSession(request);
  const isAuthenticated = Boolean(user);

  console.log(`[Middleware] User authenticated: ${isAuthenticated}`);
  console.log(`[Middleware] Is public route: ${isPublicRoute(pathname)}`);

  // If user is not authenticated
  if (!isAuthenticated) {
    // Allow access to public routes
    if (isPublicRoute(pathname)) {
      console.log(`[Middleware] Allowing access to public route: ${pathname}`);
      return supabaseResponse;
    }
    // Redirect to login for protected routes
    console.log(`[Middleware] Redirecting to login from: ${pathname}`);
    return createRedirect(request, "/login");
  }

  // If user is authenticated and trying to access auth pages
  if (isAuthenticated && isPublicRoute(pathname)) {
    console.log(`[Middleware] Redirecting authenticated user to dashboard from: ${pathname}`);
    return createRedirect(request, "/dashboard");
  }

  // User is authenticated and accessing protected routes
  console.log(`[Middleware] Allowing authenticated access to: ${pathname}`);
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (well-known URIs)
     * - manifest files and robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known|site\\.webmanifest|manifest\\.json|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
}