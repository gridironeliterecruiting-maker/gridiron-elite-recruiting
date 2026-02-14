import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.session) {
      // If this was a Google OAuth login, we'll have provider tokens
      // Pass them via URL params so the client-side hook can store them
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token

      if (providerToken) {
        // Redirect to dashboard with token flag so client captures them
        const redirectUrl = new URL(`${origin}${next}`)
        redirectUrl.searchParams.set('gmail_connected', 'true')
        return NextResponse.redirect(redirectUrl.toString())
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
