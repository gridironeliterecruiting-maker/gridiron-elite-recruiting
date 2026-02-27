'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import Image from 'next/image'

interface LoginUIProps {
  logoSrc?: string
  logoAlt?: string
  programName?: string
  primaryColor?: string
  slug?: string
}

export function LoginUI({
  logoSrc = '/logo.png',
  logoAlt = 'Gridiron Elite Recruiting',
  programName,
  primaryColor,
  slug,
}: LoginUIProps) {
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const supabase = createClient()

  const color = primaryColor || '#0047AB'

  // Only auto-redirect to dashboard for the main login page (no slug).
  // Branded pages handle auth routing server-side in [slug]/page.tsx.
  useEffect(() => {
    if (!slug) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          window.location.href = '/dashboard'
        }
      })
    }
  }, [supabase.auth, slug])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;display:flex;align-items:center;justify-content:center'
    overlay.innerHTML = `<div style="text-align:center"><div style="border:4px solid #f3f3f3;border-top:4px solid ${color};border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px"></div><p style="font-family:system-ui;color:#333">Redirecting to Google...</p></div><style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>`
    document.body.appendChild(overlay)

    // Store the slug in cookies so the auth callback can redirect back
    // to the branded page. This survives the OAuth redirect chain reliably
    // regardless of Supabase's redirect URL allowlist.
    if (slug) {
      document.cookie = `auth_redirect_slug=${slug};path=/;max-age=600;samesite=lax`
      // Also set persistent program_slug so the entire session stays branded
      document.cookie = `program_slug=${slug};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      document.body.removeChild(overlay)
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <Image src={logoSrc} alt={logoAlt} width={220} height={220} className="object-contain" />
        </div>
        {programName && (
          <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-[30px]" style={{ color }}>
            {programName}
          </h2>
        )}
        <h1 className="text-2xl font-bold mb-1" style={{ color }}>Welcome</h1>
        <p className="text-gray-500 mb-8">Sign in to your recruiting dashboard</p>

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

        <p className="mt-6 text-sm text-gray-500 leading-relaxed">
          Gmail powers your recruiting outreach. Sign in with your Google account to get started.
        </p>

        <p className="mt-4 text-xs text-gray-400">
          Don&apos;t have a Gmail account?{' '}
          <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color }}>
            Create one here
          </a>
        </p>
      </div>
    </div>
  )
}
