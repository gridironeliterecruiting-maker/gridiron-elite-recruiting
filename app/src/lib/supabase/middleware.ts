import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Track all cookies Supabase wants to set
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
          cookies.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookies.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Skip getUser() for /auth/callback to preserve PKCE code_verifier cookie.
  // When stale session cookies exist, getUser() → _getSession() → refresh fails → catch block
  // deletes the code_verifier cookie, causing exchangeCodeForSession to fail.
  // This is the root cause of the "first login attempt fails, second works" bug.
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback')
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, isAuthCallback: ${isAuthCallback}`)
  
  let user = null
  if (!isAuthCallback) {
    const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser()
    user = sessionUser
    if (userError) {
      console.error(`[Middleware] Supabase getUser error: ${userError.message}`)
    } else {
      console.log(`[Middleware] User: ${user ? user.id : 'null'}`)
    }
  }

  // Helper: create a redirect that preserves Supabase auth cookies
  const redirectWithCookies = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const response = NextResponse.redirect(url)
    // Copy ALL auth cookies to the redirect response
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  // Public routes - no auth required
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/track', '/api/unsubscribe', '/api/debug', '/api/email/process-queue', '/api/email/check-replies', '/api/gmail/oauth-callback', '/api/gmail/authorize']
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  console.log(`[Middleware] isPublicRoute: ${isPublicRoute}`)

  if (!user && !isPublicRoute) {
    console.log(`[Middleware] No user and not public route. Redirecting to /login.`)
    return redirectWithCookies('/login')
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return redirectWithCookies('/dashboard')
  }

  // Check if authenticated user needs profile setup
  if (user && !request.nextUrl.pathname.startsWith('/profile-setup') && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/auth/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, position')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.first_name || !profile.position) {
      return redirectWithCookies('/profile-setup')
    }
  }

  return supabaseResponse
}
