'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface LoginUIProps {
  logoSrc?: string
  logoAlt?: string
  programName?: string
  primaryColor?: string
  slug?: string
  registerMode?: boolean
}

export function LoginUI({
  logoSrc = '/logo.png',
  logoAlt = 'Runway Recruit',
  programName,
  primaryColor,
  slug,
  registerMode = false,
}: LoginUIProps) {
  const color = primaryColor || '#0047AB'
  const supabase = createClient()
  const router = useRouter()

  // ─── Main site: username + password ──────────────────────────────────────
  if (!slug) {
    return <MainSiteLogin color={color} logoSrc={logoSrc} logoAlt={logoAlt} registerMode={registerMode} />
  }

  // ─── Program slug sites: Google OAuth (unchanged) ─────────────────────────
  return <SlugSiteLogin color={color} logoSrc={logoSrc} logoAlt={logoAlt} programName={programName} slug={slug} registerMode={registerMode} />
}

// ── Main site login: username + password ──────────────────────────────────────

function MainSiteLogin({
  color,
  logoSrc,
  logoAlt,
  registerMode,
}: {
  color: string
  logoSrc: string
  logoAlt: string
  registerMode: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const workspaceEmail = `${username.trim().toLowerCase()}@flightschoolmail.com`

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: workspaceEmail,
      password,
    })

    if (signInError) {
      setError('Incorrect username or password.')
      setLoading(false)
      return
    }

    document.cookie = `site_session=main;path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`
    router.push('/hub')
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: 'url(/locker-room-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="relative h-[200px] w-[200px]">
            <Image src={logoSrc} alt={logoAlt} fill className="object-contain" priority />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color }}>
          {registerMode ? 'Get Started' : 'Welcome Back'}
        </h1>
        <p className="text-gray-500 mb-8">
          {registerMode
            ? 'Create your account to start recruiting.'
            : 'Sign in to your recruiting hub.'}
        </p>

        {registerMode ? (
          <div className="space-y-3">
            <Link
              href="/checkout?plan=monthly"
              className="w-full flex items-center justify-center py-4 px-6 rounded-xl text-white font-semibold transition hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)', boxShadow: '0 4px 20px rgba(200,32,47,0.4)' }}
            >
              Get Started — $50/month
            </Link>
            <Link
              href="/checkout?plan=annual"
              className="w-full flex items-center justify-center py-3 px-6 rounded-xl border-2 font-semibold transition hover:bg-blue-50"
              style={{ borderColor: color, color }}
            >
              Annual Plan — $450/year (Save 25%)
            </Link>
            <p className="text-xs text-gray-400">Already have an account?{' '}
              <Link href="/login" className="hover:underline" style={{ color }}>Sign in</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-left">
                {error}
              </div>
            )}

            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ryansmith"
                required
                autoComplete="username"
                className="w-full px-4 py-3 border-2 rounded-xl bg-white focus:outline-none text-sm"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 rounded-xl bg-white focus:outline-none text-sm"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div className="text-right -mt-1">
              <Link href="/forgot-password" className="text-xs hover:underline" style={{ color }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl text-white font-semibold transition disabled:opacity-50"
              style={{ background: color }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-xs text-gray-400 mt-4">
              Don&apos;t have an account?{' '}
              <Link href="/checkout" className="hover:underline" style={{ color }}>
                Get started
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-xs text-gray-400">
          <a href="https://runwayrecruit.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Privacy Policy
          </a>
          {' · '}
          <a href="https://runwayrecruit.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Program slug sites: unchanged Google OAuth ────────────────────────────────

function SlugSiteLogin({
  color,
  logoSrc,
  logoAlt,
  programName,
  slug,
  registerMode,
}: {
  color: string
  logoSrc: string
  logoAlt: string
  programName?: string
  slug: string
  registerMode: boolean
}) {
  const supabase = createClient()
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;display:flex;align-items:center;justify-content:center'
    overlay.innerHTML = `<div style="text-align:center"><div style="border:4px solid #f3f3f3;border-top:4px solid ${color};border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px"></div><p style="font-family:system-ui;color:#333">Redirecting to Google...</p></div><style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>`
    document.body.appendChild(overlay)

    document.cookie = `site_session=${slug};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      document.body.removeChild(overlay)
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f9fafb' }}>
      <div className="relative z-10 w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="relative h-[220px] w-[220px]">
            <Image src={logoSrc} alt={logoAlt} fill className="object-contain" priority />
          </div>
        </div>
        {programName && (
          <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-[30px]" style={{ color }}>
            {programName}
          </h2>
        )}
        <h1 className="text-2xl font-bold mb-1" style={{ color }}>
          {registerMode ? 'Register' : 'Welcome'}
        </h1>
        <p className="text-gray-500 mb-8">
          {registerMode ? 'Your recruiting takes off today.' : 'Sign in to your recruiting hub.'}
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 border-2 rounded-xl bg-white hover:bg-blue-50 transition disabled:opacity-50 shadow-sm hover:shadow-md"
          style={{ borderColor: color }}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="text-base font-semibold text-gray-700">
            {googleLoading ? 'Connecting...' : 'Sign in with Google'}
          </span>
        </button>

        <p className="mt-6 text-xs text-gray-400">
          <a href="https://runwayrecruit.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
          {' · '}
          <a href="https://runwayrecruit.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
        </p>
      </div>
    </div>
  )
}
