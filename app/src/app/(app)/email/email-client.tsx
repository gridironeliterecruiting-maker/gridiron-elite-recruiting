"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

// Realtime-only client — no auth activity at all
const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {},
        },
      }
    )
  : null

export function EmailClient({ recruitingEmail }: { recruitingEmail?: string | null }) {
  const [status, setStatus] = useState("Initializing...")

  useEffect(() => {
    if (!supabase) {
      setStatus("No supabase client (SSR)")
      return
    }

    setStatus("Waiting 5 seconds before connecting...")
    console.log('[email] Waiting 5 seconds...')

    const timer = setTimeout(() => {
      setStatus("Connecting to Realtime...")
      console.log('[email] Creating channel...')

      const channel = supabase
        .channel('test-connection')
        .on('broadcast', { event: 'test' }, (payload) => {
          console.log('[email] Broadcast received:', payload)
        })
        .subscribe((s) => {
          console.log('[email] Subscription status:', s)
          setStatus('Subscription status: ' + s)
        })

      // Store for cleanup
      ;(window as any).__testChannel = channel
    }, 5000)

    return () => {
      clearTimeout(timer)
      if ((window as any).__testChannel) {
        supabase.removeChannel((window as any).__testChannel)
      }
    }
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Email - Realtime Connection Test</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>Check browser console for details.</p>
    </div>
  )
}
