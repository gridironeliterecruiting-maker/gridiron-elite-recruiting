"use client"

import { useEffect, useState } from "react"
import { RealtimeClient } from "@supabase/realtime-js"

// Direct RealtimeClient — no createClient, no GoTrueClient, no auth overhead.
// This is the documented standalone Realtime usage from @supabase/realtime-js.
const REALTIME_URL = `wss://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}/realtime/v1`
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const realtimeClient = typeof window !== 'undefined'
  ? new RealtimeClient(REALTIME_URL, { params: { apikey: API_KEY } })
  : null

export function EmailClient({ recruitingEmail }: { recruitingEmail?: string | null }) {
  const [status, setStatus] = useState("Initializing...")

  useEffect(() => {
    if (!realtimeClient) {
      setStatus("No client (SSR)")
      return
    }

    setStatus("Connecting...")
    console.log('[email] Connecting RealtimeClient to:', REALTIME_URL)

    realtimeClient.connect()

    const channel = realtimeClient.channel('test-connection')
    channel
      .on('broadcast', { event: 'test' }, (payload) => {
        console.log('[email] Broadcast received:', payload)
      })
      .subscribe((s) => {
        console.log('[email] Subscription status:', s)
        setStatus('Status: ' + s)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Email - Realtime Connection Test</h1>
      <p><strong>{status}</strong></p>
      <p>Check browser console for details.</p>
    </div>
  )
}
