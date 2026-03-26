"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

// Single Realtime client at module level — per Supabase docs
const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : null

export function EmailClient({ recruitingEmail }: { recruitingEmail?: string | null }) {
  const [status, setStatus] = useState("Initializing...")

  useEffect(() => {
    if (!supabase) {
      setStatus("No supabase client (SSR)")
      return
    }

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

    return () => {
      supabase.removeChannel(channel)
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
