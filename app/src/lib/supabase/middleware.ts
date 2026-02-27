import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that exist under (app) — these can be prefixed with a program slug
const programRoutes = ['dashboard', 'coaches', 'pipeline', 'outreach', 'profile']

// All known top-level routes (not program slugs)
const knownTopLevel = ['dashboard', 'coaches', 'pipeline', 'outreach', 'profile', 'profile-setup', 'login', 'signup', 'auth', 'api', 'recruit', 'admin']

export async function updateSession(request: NextRequest) {
  // Serve static public files without auth
  if (request.nextUrl.pathname.match(/\.(txt|md)$/)) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

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
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Skip getUser() for OAuth callbacks to preserve PKCE code_verifier cookies.
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

  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean)
  const firstSegment = pathSegments[0]
  const secondSegment = pathSegments[1]

  // Read existing program_slug cookie
  const programSlug = request.cookies.get('program_slug')?.value

  // ─── Detect URL patterns ───────────────────────────────────
  // /{slug} — branded login page (single segment, not a known route)
  const isPotentialSlug = pathSegments.length === 1 && firstSegment !== 'admin' && !knownTopLevel.includes(firstSegment)

  // /{slug}/dashboard, /{slug}/pipeline, etc. — program-scoped app route
  const isProgramRoute = pathSegments.length >= 2
    && !knownTopLevel.includes(firstSegment)
    && firstSegment !== 'admin'
    && programRoutes.includes(secondSegment)

  // /dashboard, /pipeline, etc. — bare app route (no slug prefix)
  const isBareAppRoute = pathSegments.length >= 1 && programRoutes.includes(firstSegment)

  // Public routes — no auth required
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/admin', '/api/track', '/api/unsubscribe', '/api/email/process-queue', '/api/email/check-replies', '/api/gmail/oauth-callback', '/api/gmail/authorize', '/api/twitter/oauth-callback', '/api/access-request', '/recruit']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Helper: create a redirect that preserves Supabase auth cookies
  const redirectWithCookies = (pathname: string, slug?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = '' // clear search params on redirects
    const response = NextResponse.redirect(url)
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    const effectiveSlug = slug || programSlug
    if (effectiveSlug) {
      response.cookies.set('program_slug', effectiveSlug, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
    }
    return response
  }

  // ─── Program-scoped routes: /{slug}/dashboard etc. ─────────
  if (isProgramRoute) {
    const slug = firstSegment
    const remainingPath = '/' + pathSegments.slice(1).join('/')

    // Not authenticated → redirect to branded login
    if (!user) {
      return redirectWithCookies(`/${slug}`, slug)
    }

    // Check if user needs profile setup
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, position, role')
      .eq('id', user.id)
      .single()

    const needsSetup = !profile || !profile.first_name || (profile.role !== 'coach' && profile.role !== 'admin' && !profile.position)
    if (needsSetup) {
      const url = request.nextUrl.clone()
      url.pathname = '/profile-setup'
      url.searchParams.set('slug', slug)
      const response = NextResponse.redirect(url)
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options)
      }
      response.cookies.set('program_slug', slug, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
      return response
    }

    // Authenticated + profile complete → rewrite to bare route, pass slug via header
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = remainingPath

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-program-slug', slug)

    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })

    // Set cookies on the rewrite response
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    response.cookies.set('program_slug', slug, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })

    return response
  }

  // ─── Bare app routes: /dashboard etc. ──────────────────────
  // If a program user hits /dashboard directly, redirect to /{slug}/dashboard
  if (isBareAppRoute && user && programSlug) {
    const sluggedPath = `/${programSlug}${request.nextUrl.pathname}`
    return redirectWithCookies(sluggedPath)
  }

  // ─── Branded login page: /{slug} ──────────────────────────
  if (isPotentialSlug) {
    // Set program_slug cookie when visiting a branded page
    supabaseResponse.cookies.set('program_slug', firstSegment, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  }

  // ─── Standard auth checks ─────────────────────────────────
  if (!user && !isPublicRoute && !isPotentialSlug) {
    if (programSlug) {
      return redirectWithCookies(`/${programSlug}`)
    }
    return redirectWithCookies('/login')
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    if (programSlug) {
      return redirectWithCookies(`/${programSlug}/dashboard`)
    }
    return redirectWithCookies('/dashboard')
  }

  // Check if authenticated user needs profile setup (for non-program routes)
  if (user && !isPotentialSlug && !request.nextUrl.pathname.startsWith('/profile-setup') && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/auth/') && !request.nextUrl.pathname.startsWith('/recruit')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, position, role')
      .eq('id', user.id)
      .single()

    const needsSetup = !profile || !profile.first_name || (profile.role !== 'coach' && profile.role !== 'admin' && !profile.position)
    if (needsSetup) {
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
