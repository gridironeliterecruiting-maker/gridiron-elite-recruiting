'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')
  const supabase = createClient()
  const searchParams = useSearchParams()

  // Check for debug info in URL and also check if we have a session already
  useEffect(() => {
    const authDebug = searchParams.get('auth_debug')
    const authError = searchParams.get('error')
    if (authDebug) {
      setDebugInfo(`Auth debug: error=${authError}, code=${searchParams.get('error_code')}, has_code=${searchParams.get('has_code')}, cookies=${searchParams.get('cookies')}, has_verifier=${searchParams.get('has_verifier')}`)
    }
    
    // Check if we actually have a valid session (client-side check)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // We have a session! The middleware should have caught this.
        // This means the redirect after OAuth might have session but middleware didn't detect it
        setDebugInfo(prev => prev + ` | CLIENT HAS SESSION: ${session.user.email}`)
        // Try redirecting manually
        window.location.href = '/dashboard'
      }
    })
  }, [searchParams, supabase.auth])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
        },
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // Debug: if signInWithOAuth returned but no redirect happened
    if (data?.url) {
      setDebugInfo(`OAuth URL generated: ${data.url.substring(0, 80)}...`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <Image src="/logo.png" alt="Gridiron Elite Recruiting" width={220} height={220} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-[#0047AB] mb-1">Welcome</h1>
        <p className="text-gray-500 mb-8">Sign in to your recruiting dashboard</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {debugInfo && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-xs mb-4 text-left break-all">{debugInfo}</div>}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 border-2 border-[#0047AB] rounded-xl bg-white hover:bg-blue-50 transition disabled:opacity-50 shadow-sm hover:shadow-md"
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

        <p className="mt-6 text-sm text-gray-500 leading-relaxed">
          Gmail powers your recruiting outreach. Sign in with your Google account to get started.
        </p>

        <p className="mt-4 text-xs text-gray-400">
          Don&apos;t have a Gmail account?{' '}
          <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer" className="text-[#0047AB] hover:underline">
            Create one here
          </a>
        </p>
      </div>
    </div>
  )
}
