import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TWITTER_API_BASE = 'https://api.twitter.com/2'

async function lookupTwitterProfiles(
  accessToken: string,
  handles: string[]
): Promise<Map<string, { id: string; username: string; name: string; profile_image_url?: string }>> {
  const results = new Map<string, { id: string; username: string; name: string; profile_image_url?: string }>()
  const cleaned = handles.map(h => h.replace(/^@/, '')).filter(Boolean)
  if (!cleaned.length) return results

  // Batch up to 100 at a time
  const batches: string[][] = []
  for (let i = 0; i < cleaned.length; i += 100) {
    batches.push(cleaned.slice(i, i + 100))
  }

  for (const batch of batches) {
    try {
      const res = await fetch(
        `${TWITTER_API_BASE}/users/by?usernames=${batch.join(',')}&user.fields=profile_image_url,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const user of (data.data || [])) {
        // Upgrade profile image from _normal (48px) to _200x200 for better quality
        const imageUrl = user.profile_image_url
          ? user.profile_image_url.replace('_normal', '_200x200')
          : null
        results.set(user.username.toLowerCase(), { ...user, profile_image_url: imageUrl })
      }
    } catch {
      // Lookup failure is non-fatal — partners still save without profile data
    }
  }

  return results
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: partners } = await supabase
    .from('x_partner_profiles')
    .select('id, twitter_handle, display_name, profile_image_url')
    .eq('athlete_id', user.id)
    .order('created_at')

  return NextResponse.json({ partners: partners || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { handles } = await request.json()
  if (!Array.isArray(handles) || handles.length === 0) {
    return NextResponse.json({ error: 'handles required' }, { status: 400 })
  }

  const cleaned = handles.map((h: string) => h.trim().replace(/^@/, '')).filter(Boolean)
  if (!cleaned.length) return NextResponse.json({ error: 'No valid handles' }, { status: 400 })

  // Try to get the athlete's Twitter access_token for profile lookups
  const admin = createAdminClient()
  const { data: twitterToken } = await admin
    .from('twitter_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', user.id)
    .single()

  let profileMap = new Map<string, { id: string; username: string; name: string; profile_image_url?: string }>()
  if (twitterToken?.access_token) {
    profileMap = await lookupTwitterProfiles(twitterToken.access_token, cleaned)
  }

  // Upsert each handle
  const rows = cleaned.map(handle => {
    const profile = profileMap.get(handle.toLowerCase())
    return {
      athlete_id: user.id,
      twitter_handle: handle,
      twitter_user_id: profile?.id || null,
      display_name: profile?.name || null,
      profile_image_url: profile?.profile_image_url || null,
    }
  })

  const { data: saved, error } = await supabase
    .from('x_partner_profiles')
    .upsert(rows, { onConflict: 'athlete_id,twitter_handle' })
    .select('id, twitter_handle, display_name, profile_image_url')

  if (error) {
    console.error('[X Partners] Upsert failed:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ partners: saved || [] })
}
