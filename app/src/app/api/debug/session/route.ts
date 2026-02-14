import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  
  return NextResponse.json({
    user_id: user?.id || null,
    email: user?.email || null,
    provider: user?.app_metadata?.provider || null,
    has_provider_token: !!session?.provider_token,
    has_refresh_token: !!session?.provider_refresh_token,
  })
}
