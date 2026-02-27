import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAppUrl } from '@/lib/app-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = getAppUrl(request)
  const cookieStore = await cookies()

  // site_session tells us which site the user logged in from
  const siteSession = cookieStore.get('site_session')?.value

  let next = '/dashboard'
  if (siteSession && siteSession !== 'main') {
    if (siteSession === 'admin') {
      next = '/admin'
    } else {
      next = `/${siteSession}/dashboard`
    }
  }

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
      return response
    }
  }

  // On error, redirect to the appropriate login page for the site
  let loginPath = '/login'
  if (siteSession && siteSession !== 'main') {
    loginPath = siteSession === 'admin' ? '/admin' : `/${siteSession}`
  }
  return NextResponse.redirect(new URL(loginPath, appUrl).toString())
}
