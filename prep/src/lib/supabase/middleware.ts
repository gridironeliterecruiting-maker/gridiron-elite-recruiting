import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const appRoutes = ['hub', 'camps', 'media', 'email', 'profile']

const alwaysPublic = [
  '/auth/callback',
  '/auth/reset-password',
  '/api/track',
  '/api/unsubscribe',
  '/api/email/process-queue',
  '/api/email/check-replies',
  '/api/twitter/oauth-callback',
  '/api/stripe',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/complete-profile',
  '/forgot-password',
  '/register',
]

export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname.match(/\.(txt|md)$/)) {
    return NextResponse.next()
  }

  const isAlwaysPublic = alwaysPublic.some(route => request.nextUrl.pathname.startsWith(route))
  if (isAlwaysPublic) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const firstSegment = request.nextUrl.pathname.split('/').filter(Boolean)[0]
  const siteSession = request.cookies.get('site_session')?.value

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    const response = NextResponse.redirect(url)
    for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
    return response
  }

  const passThrough = () => {
    for (const { name, value, options } of cookiesToSet) supabaseResponse.cookies.set(name, value, options)
    return supabaseResponse
  }

  const isLoginRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register'
  const isAppRoute = appRoutes.includes(firstSegment)

  if (isLoginRoute) {
    if (user && siteSession === 'main') return redirectTo('/hub')
    return passThrough()
  }

  if (isAppRoute) {
    if (!user || siteSession !== 'main') return redirectTo('/login')

    if (!request.nextUrl.pathname.startsWith('/profile-setup')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, position')
        .eq('id', user.id)
        .single()

      const needsSetup = !profile || !profile.first_name || !profile.position
      if (needsSetup) return redirectTo('/profile-setup')

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!sub) return redirectTo('/checkout')
    }

    return passThrough()
  }

  if (request.nextUrl.pathname.startsWith('/profile-setup')) {
    if (!user) return redirectTo('/login')
    return passThrough()
  }

  return passThrough()
}
