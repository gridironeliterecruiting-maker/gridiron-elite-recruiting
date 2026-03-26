import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      // Fix WebSocket CHANNEL_ERROR: supabase-js passes undefined as protocol
      // to WebSocket constructor, causing invalid Sec-WebSocket-Protocol header.
      // https://github.com/supabase/supabase-js/issues/1473
      ...(typeof window !== 'undefined' && {
        realtime: {
          transport: ((url: string) => new WebSocket(url)) as unknown as typeof WebSocket,
        },
      }),
    }
  )
}
