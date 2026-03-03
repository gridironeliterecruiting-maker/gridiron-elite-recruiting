import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAppUrl } from '@/lib/app-url'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const code = searchParams.get('code')
  const supabaseError = searchParams.get('error')
  const supabaseErrorDesc = searchParams.get('error_description')
  const appUrl = getAppUrl(request)

  // Supabase sent an explicit error
  if (supabaseError) {
    const msg = supabaseErrorDesc || supabaseError
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, appUrl).toString()
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
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
      const response = NextResponse.redirect(new URL('/dashboard', appUrl).toString())
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options as Record<string, unknown>)
      }
      return response
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, appUrl).toString()
    )
  }

  // No code, no error — dump all params so we can see what arrived
  const allParams = searchParams.toString() || 'none'
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent('no_code. params: ' + allParams)}`, appUrl).toString()
  )
}
