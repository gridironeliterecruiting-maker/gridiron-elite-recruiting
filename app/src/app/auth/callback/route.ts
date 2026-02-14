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
    
    // Debug: log the error so we can see what's failing
    console.error('[auth/callback] exchangeCodeForSession error:', error.message, error)
    
    // Debug: check what cookies were available
    const allCookies = cookieStore.getAll()
    const codeVerifierCookie = allCookies.find(c => c.name.includes('code-verifier') || c.name.includes('code_verifier'))
    console.error('[auth/callback] code_verifier cookie present:', !!codeVerifierCookie, 'all cookies:', allCookies.map(c => c.name))
  }

  // Debug: log if no code was present
  if (!code) {
    console.error('[auth/callback] No code in URL params. searchParams:', Object.fromEntries(searchParams.entries()))
  }

  return NextResponse.redirect(new URL('/login', appUrl).toString())
}
