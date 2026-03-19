'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/login'
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isGoogleUser, setIsGoogleUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Check if Google-only account server-side
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (data.googleUser) {
        setIsGoogleUser(true)
        setSubmitted(true)
        return
      }

      // Send reset email client-side so PKCE code verifier is stored in browser
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/locker-room-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="relative h-[100px] w-[100px]">
            <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {submitted ? (
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#f0f4ff' }}
              >
                {isGoogleUser ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#0047AB" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              {isGoogleUser ? (
                <>
                  <h1 className="text-xl font-bold text-[#0047AB] mb-2">Google Account</h1>
                  <p className="text-gray-500 text-sm mb-6">
                    This email is linked to a Google account. To reset your password, visit your Google account settings at{' '}
                    <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-[#0047AB] hover:underline">
                      myaccount.google.com
                    </a>.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-[#0047AB] mb-2">Check your email</h1>
                  <p className="text-gray-500 text-sm mb-6">
                    If an account exists for that email, a password reset link has been sent.
                  </p>
                </>
              )}

              <Link href={returnTo} className="text-sm text-[#0047AB] hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-[#0047AB] mb-1">Forgot password?</h1>
              <p className="text-gray-500 text-sm mb-6">
                Enter your email and we&apos;ll send a reset link.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                  style={{ background: '#1a3a6e' }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-4">
                <Link href="/login" className="text-[#0047AB] hover:underline">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
