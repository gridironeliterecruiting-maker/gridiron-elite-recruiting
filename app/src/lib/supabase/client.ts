import { createBrowserClient } from '@supabase/ssr'

// WebSocket wrapper that ignores the protocol parameter to prevent
// invalid Sec-WebSocket-Protocol: undefined header
class SafeWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    // Only pass protocols if they are defined and not empty
    if (protocols && protocols !== 'undefined' && protocols.length > 0) {
      super(url, protocols)
    } else {
      super(url)
    }
  }
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      ...(typeof window !== 'undefined' && {
        realtime: {
          transport: SafeWebSocket as unknown as typeof WebSocket,
        },
      }),
    }
  )
}
