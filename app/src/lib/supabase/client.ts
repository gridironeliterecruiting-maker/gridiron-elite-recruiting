import { createBrowserClient } from '@supabase/ssr'

// WebSocket wrapper that filters out undefined protocol parameter
class SafeWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
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
