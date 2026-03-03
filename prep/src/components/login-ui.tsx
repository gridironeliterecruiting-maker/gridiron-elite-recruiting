'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'

export function LoginUI() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Logo / Brand */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900 mb-4">
              <svg viewBox="0 0 40 40" className="w-10 h-10 fill-white">
                <path d="M20 4L36 12v16L20 36 4 28V12L20 4z" opacity="0.2" />
                <path d="M20 2L38 11v18L20 38 2 29V11L20 2zm0 4L6 13v14l14 7 14-7V13L20 6z" />
                <path d="M14 18h12M14 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-blue-900 font-display tracking-wide uppercase">
              Runway Elite Prep
            </h1>
            <p className="text-sm text-gray-500 mt-1">Runway Sports Technologies</p>
          </div>

          <p className="text-gray-600 mb-8 text-sm leading-relaxed">
            The athlete development platform for 6th–8th grade student-athletes and their families.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 border-2 border-blue-900 rounded-xl bg-white hover:bg-blue-50 transition disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-base font-semibold text-gray-700">
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </span>
          </button>

          <p className="mt-6 text-xs text-gray-400 leading-relaxed">
            Parents: sign in to manage your athlete&apos;s development journey.
            <br />
            Athletes: your parent will link your account after setup.
          </p>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center gap-4 text-xs text-gray-400">
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" className="hover:underline">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  )
}
