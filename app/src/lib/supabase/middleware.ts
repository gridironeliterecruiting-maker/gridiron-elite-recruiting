import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Serve static public files (like CLAUDE.md/txt) without auth
  if (request.nextUrl.pathname.match(/\.(txt|md)$/)) {
    return NextResponse.next()
  }

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

  // IMPORTANT: Skip getUser() for OAuth callbacks to preserve PKCE code_verifier cookies.
  // When stale session cookies exist, getUser() → _getSession() → refresh fails → catch block
  // deletes cookies, causing token exchange to fail.
  const isOAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback')
    || request.nextUrl.pathname.startsWith('/api/twitter/oauth-callback')
    || request.nextUrl.pathname.startsWith('/api/gmail/oauth-callback')

  let user = null
  if (!isOAuthCallback) {
    const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser()
    user = sessionUser
    if (userError) {
      console.error(`[Middleware] getUser error on ${request.nextUrl.pathname}: ${userError.message}`)
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
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/track', '/api/unsubscribe', '/api/email/process-queue', '/api/email/check-replies', '/api/gmail/oauth-callback', '/api/gmail/authorize', '/api/twitter/oauth-callback', '/api/access-request', '/recruit']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Allow potential landing page slugs (e.g. /prairie-ia) — single path segment, not a known route
  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean)
  const knownTopLevel = ['dashboard', 'coaches', 'pipeline', 'outreach', 'profile', 'profile-setup', 'login', 'signup', 'auth', 'api', 'recruit']
  const isPotentialSlug = pathSegments.length === 1 && !knownTopLevel.includes(pathSegments[0])

  if (!user && !isPublicRoute && !isPotentialSlug) {
    return redirectWithCookies('/login')
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return redirectWithCookies('/dashboard')
  }

  // Check if authenticated user needs profile setup
  if (user && !isPotentialSlug && !request.nextUrl.pathname.startsWith('/profile-setup') && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/auth/') && !request.nextUrl.pathname.startsWith('/recruit')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, position, role')
      .eq('id', user.id)
      .single()

    // Coaches only need first_name set; athletes need first_name + position
    const needsSetup = !profile || !profile.first_name || (profile.role !== 'coach' && !profile.position)
    if (needsSetup) {
      return redirectWithCookies('/profile-setup')
    }
  }

  return supabaseResponse
}
