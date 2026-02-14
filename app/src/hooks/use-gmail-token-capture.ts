'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Hook that captures Gmail provider tokens after Google OAuth redirect.
 * Should be used in the dashboard/layout component.
 */
export function useGmailTokenCapture() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const capturedRef = useRef(false)

  useEffect(() => {
    if (capturedRef.current) return

    const gmailConnected = searchParams.get('gmail_connected')
    if (!gmailConnected) return

    capturedRef.current = true

    async function captureTokens() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) return

        const providerToken = session.provider_token
        const providerRefreshToken = session.provider_refresh_token

        if (providerToken) {
          // Store tokens via our API
          const res = await fetch('/api/gmail/store-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider_token: providerToken,
              provider_refresh_token: providerRefreshToken,
            }),
          })

          if (res.ok) {
            console.log('Gmail tokens stored successfully')
          } else {
            console.error('Failed to store Gmail tokens')
          }
        }

        // Clean up URL params
        router.replace('/dashboard', { scroll: false })
      } catch (error) {
        console.error('Gmail token capture error:', error)
      }
    }

    captureTokens()
  }, [searchParams, supabase, router])
}
