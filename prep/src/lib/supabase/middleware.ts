import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const alwaysPublic = ['/auth/callback', '/auth/exchange', '/api/stripe/webhook']

export async function updateSession(request: NextRequest) {
  const isAlwaysPublic = alwaysPublic.some(r => request.nextUrl.pathname.startsWith(r))
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
          cookies.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const passThrough = () => {
    for (const { name, value, options } of cookiesToSet) {
      supabaseResponse.cookies.set(name, value, options)
    }
    return supabaseResponse
  }

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    const response = NextResponse.redirect(url)
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  // Public pages — login, privacy, terms
  if (path === '/login' || path === '/privacy' || path === '/terms') {
    // Logged-in users going to /login → dashboard
    if (user && path === '/login') return redirectTo('/dashboard')
    return passThrough()
  }

  // All (app) routes require auth
  if (!user) return redirectTo('/login')

  // Profile setup — let through if needed
  if (path.startsWith('/profile-setup')) return passThrough()

  // Check profile completeness for app routes
  if (!path.startsWith('/api')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, role')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.first_name) {
      return redirectTo('/profile-setup')
    }
  }

  return passThrough()
}
