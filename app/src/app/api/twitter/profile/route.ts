import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTwitterToken } from '@/lib/twitter'

const TWITTER_API_BASE = 'https://api.twitter.com/2'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to access twitter_tokens (bypasses RLS)
    const admin = createAdminClient()
    const { data: token } = await admin
      .from('twitter_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!token) {
      return NextResponse.json({ connected: false })
    }

    // Refresh token if expired
    let accessToken = token.access_token
    if (token.token_expiry && new Date(token.token_expiry) <= new Date()) {
      if (!token.refresh_token) {
        return NextResponse.json({
          connected: true,
          error: 'Twitter token expired and no refresh token available. Please re-authorize.',
        })
      }

      try {
        const refreshed = await refreshTwitterToken(token.refresh_token)
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

        await admin
          .from('twitter_tokens')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token || token.refresh_token,
            token_expiry: newExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', token.id)

        accessToken = refreshed.access_token
      } catch (refreshError) {
        console.error('[Twitter Profile] Token refresh failed:', refreshError)
        return NextResponse.json({
          connected: true,
          error: 'Failed to refresh Twitter token. Please re-authorize.',
        })
      }
    }

    // Fetch user profile from Twitter API v2
    const userFields = 'description,profile_image_url,public_metrics,protected,pinned_tweet_id,created_at'
    const meRes = await fetch(`${TWITTER_API_BASE}/users/me?user.fields=${userFields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!meRes.ok) {
      const errorText = await meRes.text()
      console.error('[Twitter Profile] /users/me failed:', meRes.status, errorText)
      return NextResponse.json({
        connected: true,
        error: `Twitter API error: ${meRes.status}`,
      })
    }

    const meData = await meRes.json()
    const twitterUser = meData.data

    // Fetch pinned tweet if exists
    let pinnedTweet: { text: string; hasMedia: boolean; createdAt: string } | null = null
    if (twitterUser.pinned_tweet_id) {
      try {
        const tweetFields = 'text,created_at,public_metrics'
        const expansions = 'attachments.media_keys'
        const mediaFields = 'type,url,preview_image_url'
        const pinnedRes = await fetch(
          `${TWITTER_API_BASE}/tweets/${twitterUser.pinned_tweet_id}?tweet.fields=${tweetFields}&expansions=${expansions}&media.fields=${mediaFields}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (pinnedRes.ok) {
          const pinnedData = await pinnedRes.json()
          const tweet = pinnedData.data
          const hasMedia = !!(pinnedData.includes?.media && pinnedData.includes.media.length > 0)

          pinnedTweet = {
            text: tweet.text,
            hasMedia,
            createdAt: tweet.created_at,
          }
        } else {
          console.error('[Twitter Profile] Pinned tweet fetch failed:', pinnedRes.status)
        }
      } catch (pinnedError) {
        console.error('[Twitter Profile] Pinned tweet fetch error:', pinnedError)
      }
    }

    // Fetch recent tweets to check "posted in last 7 days"
    let lastTweetAt: string | null = null
    try {
      const tweetsRes = await fetch(
        `${TWITTER_API_BASE}/users/${twitterUser.id}/tweets?max_results=5&tweet.fields=created_at`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (tweetsRes.ok) {
        const tweetsData = await tweetsRes.json()
        if (tweetsData.data && tweetsData.data.length > 0) {
          lastTweetAt = tweetsData.data[0].created_at
        }
      } else {
        console.error('[Twitter Profile] Recent tweets fetch failed:', tweetsRes.status)
      }
    } catch (tweetsError) {
      console.error('[Twitter Profile] Recent tweets fetch error:', tweetsError)
    }

    const publicMetrics = twitterUser.public_metrics || {}

    return NextResponse.json({
      connected: true,
      profile: {
        id: twitterUser.id,
        username: twitterUser.username,
        name: twitterUser.name,
        description: twitterUser.description || '',
        profileImageUrl: twitterUser.profile_image_url || null,
        followersCount: publicMetrics.followers_count || 0,
        followingCount: publicMetrics.following_count || 0,
        tweetCount: publicMetrics.tweet_count || 0,
        isProtected: twitterUser.protected || false,
        createdAt: twitterUser.created_at || null,
        pinnedTweet,
        lastTweetAt,
      },
    })
  } catch (error) {
    console.error('[Twitter Profile] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
