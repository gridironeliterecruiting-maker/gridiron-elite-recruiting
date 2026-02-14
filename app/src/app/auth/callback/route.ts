import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'

  if (code) {
    const cookieStore = await cookies()
    const allCookiesBefore = cookieStore.getAll()
    const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookies) {
            pendingCookies.push(...cookies)
            cookies.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options) } catch {}
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const redirectUrl = new URL(next, appUrl)
      const response = NextResponse.redirect(redirectUrl.toString())
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options as Record<string, unknown>)
      }
      return response
    }
    
    // DEBUG: redirect to login with error details visible in URL
    const debugUrl = new URL('/login', appUrl)
    debugUrl.searchParams.set('auth_debug', 'true')
    debugUrl.searchParams.set('error', error.message || 'unknown')
    debugUrl.searchParams.set('error_code', error.code || 'none')
    debugUrl.searchParams.set('has_code', 'true')
    debugUrl.searchParams.set('cookies', allCookiesBefore.map(c => c.name).join(','))
    debugUrl.searchParams.set('has_verifier', String(allCookiesBefore.some(c => c.name.includes('code-verifier') || c.name.includes('code_verifier'))))
    return NextResponse.redirect(debugUrl.toString())
  }

  // No code — redirect with debug info
  const debugUrl = new URL('/login', appUrl)
  debugUrl.searchParams.set('auth_debug', 'true')
  debugUrl.searchParams.set('error', 'no_code')
  debugUrl.searchParams.set('params', [...searchParams.keys()].join(','))
  return NextResponse.redirect(debugUrl.toString())
}
