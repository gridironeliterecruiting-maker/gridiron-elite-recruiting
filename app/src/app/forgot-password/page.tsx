'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      // Always show success regardless of response to avoid enumeration
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
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#0047AB" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#0047AB] mb-2">Check your email</h1>
              <p className="text-gray-500 text-sm mb-6">
                If that username exists, a password reset link has been sent to your recovery email address.
              </p>
              <Link href="/login" className="text-sm text-[#0047AB] hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-[#0047AB] mb-1">Forgot password?</h1>
              <p className="text-gray-500 text-sm mb-6">
                Enter your username and we&apos;ll send a reset link to your recovery email.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="ryansmith"
                    required
                    autoComplete="username"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
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
