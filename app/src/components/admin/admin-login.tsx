'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PRIMARY_COLOR = '#1a3a6e' // hsl(224 76% 30%)

export function AdminLogin() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Sign out any existing session silently on mount
  useEffect(() => {
    supabase.auth.signOut()
    document.cookie = 'site_session=;path=/;max-age=0'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError || !user) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    // Verify admin role via server route (bypasses RLS)
    const res = await fetch('/api/auth/admin-check')
    if (!res.ok) {
      await supabase.auth.signOut()
      setError('Access denied.')
      setLoading(false)
      return
    }

    document.cookie = `site_session=admin;path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    router.push('/admin')
    router.refresh()
  }

  return (
    <div
      className="relative min-h-screen flex items-start justify-center py-12 px-4"
      style={{
        backgroundImage: 'url(/hero-bg-day-3.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.62)' }} aria-hidden />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">

        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-[160px] w-[160px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image src="/RR_jet.png" alt="Runway Recruit" fill className="object-contain" priority />
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-widest" style={{ color: PRIMARY_COLOR }}>
            Runway Recruit
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 mt-0.5">
            Admin Portal
          </p>
        </div>

        {/* Login box */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome Back</h2>
          <p className="text-sm text-gray-500 mb-5">Sign in to the command center.</p>

          <form onSubmit={handleSignIn} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => (e.target.style.borderColor = PRIMARY_COLOR)}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={e => (e.target.style.borderColor = PRIMARY_COLOR)}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <div className="text-right -mt-2">
              <Link href="/forgot-password?returnTo=/admin" className="text-xs hover:underline" style={{ color: PRIMARY_COLOR }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-semibold transition disabled:opacity-50"
              style={{ background: PRIMARY_COLOR }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-3 text-center text-xs text-gray-400">
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
