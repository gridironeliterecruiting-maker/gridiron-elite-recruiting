'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthExchange() {
  const router = useRouter()

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description')

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(errorDesc || error)}`)
      return
    }

    if (!code) {
      router.replace('/login?error=no_code')
      return
    }

    createClient().auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`)
      } else {
        router.replace('/dashboard')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
      <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
        <p className="text-blue-900 font-semibold text-lg">Signing you in...</p>
      </div>
    </div>
  )
}
