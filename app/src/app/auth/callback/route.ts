import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAppUrl } from '@/lib/app-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = getAppUrl(request)
  const cookieStore = await cookies()

  // Check for slug cookie set by LoginUI before OAuth
  const slugCookie = cookieStore.get('auth_redirect_slug')
  const next = slugCookie?.value
    ? `/${slugCookie.value}`
    : (searchParams.get('next') ?? '/dashboard')

  if (code) {
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
      // Clear the slug cookie after use
      if (slugCookie) {
        response.cookies.set('auth_redirect_slug', '', { path: '/', maxAge: 0 })
      }
      return response
    }

  }

  return NextResponse.redirect(new URL('/login', appUrl).toString())
}
