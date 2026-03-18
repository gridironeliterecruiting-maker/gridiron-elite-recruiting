import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAppUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const slugParam = searchParams.get('slug')
  const inviteCode = searchParams.get('invite_code')
  const existingUser = searchParams.get('existing') === '1'
  const appUrl = getAppUrl(request)
  const cookieStore = await cookies()

  // site_session tells us which site the user logged in from
  const siteSession = cookieStore.get('site_session')?.value

  let next = '/hub'
  if (siteSession && siteSession !== 'main') {
    if (siteSession === 'admin') {
      next = '/admin'
    } else {
      next = `/${siteSession}/hub`
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
      // Existing user joining a program via invite code (Google OAuth from login-with-code page)
      if (slugParam && inviteCode && existingUser) {
        const { data: { user: authedUser } } = await supabase.auth.getUser()
        if (authedUser) {
          const admin = createAdminClient()
          const upperCode = inviteCode.trim().toUpperCase()
          const { data: program } = await admin
            .from('managed_programs')
            .select('id, coach_invite_code, player_invite_code')
            .eq('landing_slug', slugParam)
            .maybeSingle()
          if (program) {
            let memberRole: 'coach' | 'player' | null = null
            if (upperCode === program.coach_invite_code) memberRole = 'coach'
            else if (upperCode === program.player_invite_code) memberRole = 'player'
            if (memberRole) {
              await admin.from('program_members').upsert({
                program_id: program.id,
                user_id: authedUser.id,
                email: authedUser.email,
                role: memberRole,
                registered_via: 'existing_user_invite',
              }, { onConflict: 'program_id,email' })
            }
          }
        }
        next = `/${slugParam}/hub`
      }
      // For slug Google OAuth: new users go to profile-setup with slug + invite code
      else if (slugParam && inviteCode) {
        next = `/profile-setup?slug=${encodeURIComponent(slugParam)}&code=${encodeURIComponent(inviteCode)}`
      }

      // For main site Google OAuth: check if user has a profile. If not → checkout.
      if (siteSession === 'main') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name')
            .eq('id', user.id)
            .single()

          const isNewUser = !profile || !profile.first_name
          if (isNewUser) {
            next = '/checkout'
          }
        }
      }

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
