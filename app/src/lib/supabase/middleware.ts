import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that exist under (app) — these can be prefixed with a program slug
const programRoutes = ['hub', 'coaches', 'pipeline', 'outreach', 'profile']

// All known top-level routes (not program slugs)
const knownTopLevel = ['hub', 'coaches', 'pipeline', 'outreach', 'profile', 'profile-setup', 'login', 'signup', 'auth', 'api', 'recruit', 'admin', 'checkout', 'welcome', 'forgot-password']

// Routes the middleware never blocks (no auth or site_session check)
const alwaysPublic = ['/auth/callback', '/auth/reset-password', '/api/track', '/api/unsubscribe', '/api/email/process-queue', '/api/email/check-replies', '/api/gmail/oauth-callback', '/api/gmail/authorize', '/api/twitter/oauth-callback', '/api/access-request', '/recruit', '/checkout', '/api/stripe', '/api/auth/check-username', '/api/auth/complete-profile', '/api/auth/forgot-password', '/forgot-password']

export async function updateSession(request: NextRequest) {
  // Serve static public files without auth
  if (request.nextUrl.pathname.match(/\.(txt|md)$/)) {
    return NextResponse.next()
  }

  // Always-public routes — skip all checks
  const isAlwaysPublic = alwaysPublic.some(route => request.nextUrl.pathname.startsWith(route))
  if (isAlwaysPublic) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

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

  const { data: { user } } = await supabase.auth.getUser()

  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean)
  const firstSegment = pathSegments[0]
  const secondSegment = pathSegments[1]

  // Which site is the user currently logged into?
  const siteSession = request.cookies.get('site_session')?.value

  // Helper: redirect preserving Supabase cookies, setting site_session
  const redirectTo = (pathname: string, setSiteSession?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    const response = NextResponse.redirect(url)
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    if (setSiteSession) {
      response.cookies.set('site_session', setSiteSession, {
        path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax'
      })
    }
    return response
  }

  // Helper: pass-through preserving Supabase cookies
  const passThrough = () => {
    for (const { name, value, options } of cookiesToSet) {
      supabaseResponse.cookies.set(name, value, options)
    }
    return supabaseResponse
  }

  // ─── DETECT URL PATTERN ────────────────────────────────────

  // /{slug}/dashboard etc. — program-scoped app route
  const isProgramRoute = pathSegments.length >= 2
    && !knownTopLevel.includes(firstSegment)
    && programRoutes.includes(secondSegment)

  // /{slug} — branded login page (single segment, not a known route)
  const isProgramLogin = pathSegments.length === 1
    && !knownTopLevel.includes(firstSegment)

  // /dashboard, /pipeline etc. — generic app route (no slug)
  const isGenericAppRoute = pathSegments.length >= 1 && programRoutes.includes(firstSegment)

  // /admin — admin site
  const isAdminRoute = firstSegment === 'admin'

  // /login, /signup — generic login pages
  const isGenericLoginRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup'

  // ─── PROGRAM-SCOPED ROUTES: /{slug}/dashboard etc. ─────────
  if (isProgramRoute) {
    const slug = firstSegment
    const remainingPath = '/' + pathSegments.slice(1).join('/')

    // Must be logged into THIS site
    if (!user || siteSession !== slug) {
      return redirectTo(`/${slug}`)
    }

    // Check profile setup
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
      return response
    }

    // Rewrite to bare route, pass slug via header
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = remainingPath

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-program-slug', slug)

    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })

    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  // ─── PROGRAM LOGIN PAGE: /{slug} ───────────────────────────
  if (isProgramLogin) {
    // If already logged into THIS site, redirect to dashboard
    if (user && siteSession === firstSegment) {
      return redirectTo(`/${firstSegment}/hub`)
    }
    // Otherwise show the login page (regardless of Supabase session)
    return passThrough()
  }

  // ─── ADMIN ROUTES ──────────────────────────────────────────
  if (isAdminRoute) {
    // /admin itself — show login page if not logged into admin site
    if (pathSegments.length === 1) {
      // If already logged into admin, pass through to admin page (it handles role check)
      if (user && siteSession === 'admin') {
        return passThrough()
      }
      // Not logged into admin — show admin login page
      return passThrough()
    }
    // Any sub-routes under /admin — must be logged into admin site
    if (!user || siteSession !== 'admin') {
      return redirectTo('/admin')
    }
    return passThrough()
  }

  // ─── GENERIC LOGIN: /login, /signup ────────────────────────
  if (isGenericLoginRoute) {
    // Already logged into main site → hub
    if (user && siteSession === 'main') {
      return redirectTo('/hub')
    }
    return passThrough()
  }

  // ─── GENERIC APP ROUTES: /hub etc. ─────────────────────────
  if (isGenericAppRoute) {
    // Must be logged into main site
    if (!user || siteSession !== 'main') {
      return redirectTo('/login')
    }

    // Check profile setup
    if (!request.nextUrl.pathname.startsWith('/profile-setup')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, position, role, is_grandfathered')
        .eq('id', user.id)
        .single()

      const needsSetup = !profile || !profile.first_name || (profile.role !== 'coach' && profile.role !== 'admin' && !profile.position)
      if (needsSetup) {
        return redirectTo('/profile-setup')
      }

      // Subscription gate — skip for grandfathered users and admins/coaches
      if (profile && !profile.is_grandfathered && profile.role !== 'admin' && profile.role !== 'coach') {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (!sub) {
          return redirectTo('/checkout')
        }
      }
    }

    return passThrough()
  }

  // ─── PROFILE SETUP ─────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith('/profile-setup')) {
    // Allow through when coming from checkout (has sub_id param = new user, not yet in auth)
    const subId = request.nextUrl.searchParams.get('sub_id')
    if (!user && !subId) return redirectTo('/login')
    return passThrough()
  }

  // ─── WELCOME ────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith('/welcome')) {
    return passThrough()
  }

  return passThrough()
}
