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

  // Read the persistent program slug cookie (set when user enters via a branded page)
  const programSlug = request.cookies.get('program_slug')?.value

  // Helper: create a redirect that preserves Supabase auth cookies + program_slug
  const redirectWithCookies = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const response = NextResponse.redirect(url)
    // Copy ALL auth cookies to the redirect response
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    // Preserve program_slug cookie on redirects
    if (programSlug) {
      response.cookies.set('program_slug', programSlug, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
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

  // When visiting a branded program page, set the persistent program_slug cookie
  // so the entire session stays branded (layout, redirects, sign-out all respect it).
  // Exclude 'admin' — that's the admin panel, not a program page.
  if (isPotentialSlug && pathSegments[0] !== 'admin') {
    supabaseResponse.cookies.set('program_slug', pathSegments[0], {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    })
  }

  if (!user && !isPublicRoute && !isPotentialSlug) {
    // If user entered through a branded page, send them back there instead of generic /login
    if (programSlug) {
      return redirectWithCookies(`/${programSlug}`)
    }
    return redirectWithCookies('/login')
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    // If user belongs to a program, send them to /dashboard (layout will brand it)
    return redirectWithCookies('/dashboard')
  }

  // Check if authenticated user needs profile setup
  if (user && !isPotentialSlug && !request.nextUrl.pathname.startsWith('/profile-setup') && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/auth/') && !request.nextUrl.pathname.startsWith('/recruit')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, position, role')
      .eq('id', user.id)
      .single()

    // Coaches and admins only need first_name set; athletes need first_name + position
    const needsSetup = !profile || !profile.first_name || (profile.role !== 'coach' && profile.role !== 'admin' && !profile.position)
    if (needsSetup) {
      // Preserve program context through profile setup
      if (programSlug) {
        const url = request.nextUrl.clone()
        url.pathname = '/profile-setup'
        url.searchParams.set('slug', programSlug)
        const response = NextResponse.redirect(url)
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        response.cookies.set('program_slug', programSlug, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
        return response
      }
      return redirectWithCookies('/profile-setup')
    }
  }

  return supabaseResponse
}
