'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PRIMARY_COLOR = '#cc2222'

export function LoginUI() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (signInError) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }
    document.cookie = `site_session=main;path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    router.push('/hub')
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    document.cookie = `site_session=main;path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (oauthError) { setError(oauthError.message); setGoogleLoading(false) }
  }

  return (
    <div
      className="relative min-h-screen flex items-start justify-center py-12 px-4"
      style={{ backgroundImage: 'url(/locker-room-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.62)' }} aria-hidden />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-[160px] w-[160px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image src="/logo.png" alt="Runway Prep" fill className="object-contain" priority />
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-widest" style={{ color: PRIMARY_COLOR }}>
            Runway Prep
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 mt-0.5">
            Build Your Foundation
          </p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome Back</h2>
          <p className="text-sm text-gray-500 mb-5">Sign in to your athlete dashboard.</p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required autoComplete="email"
                className="w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => (e.target.style.borderColor = PRIMARY_COLOR)}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" required autoComplete="current-password"
                className="w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => (e.target.style.borderColor = PRIMARY_COLOR)}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
            <div className="text-right -mt-2">
              <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: PRIMARY_COLOR }}>Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading || googleLoading}
              className="w-full py-3.5 rounded-xl text-white font-semibold transition disabled:opacity-50"
              style={{ background: PRIMARY_COLOR }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading || loading}
            className="mt-3 w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50 text-gray-500 hover:text-gray-700">
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-xs font-medium">{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: PRIMARY_COLOR }}>Get started</Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-400">
          <a href="https://runwayprep.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
          {' · '}
          <a href="https://runwayprep.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
        </p>
      </div>
    </div>
  )
}
