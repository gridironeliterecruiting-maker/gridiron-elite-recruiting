/**
 * ONE-TIME USE: Re-provision a Zoho mailbox for a user whose zoho_account_key
 * is missing/bogus but workspace_email is already set correctly.
 *
 * DELETE THIS FILE after use.
 *
 * Usage: GET /api/admin/reprovision-zoho?userId=<uid>&secret=<ADMIN_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionZohoAccount, getZohoAccessToken } from '@/lib/workspace'

const ADMIN_SECRET = process.env.ADMIN_API_SECRET || 'runway-reprovision-2026'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const userId = searchParams.get('userId')

  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, workspace_email, zoho_account_key')
    .eq('id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.workspace_email) {
    return NextResponse.json({ error: 'No workspace_email set on profile' }, { status: 400 })
  }

  if (profile.zoho_account_key) {
    return NextResponse.json({ message: 'Already provisioned', accountKey: profile.zoho_account_key, email: profile.workspace_email })
  }

  // Extract username from the pre-set workspace_email
  const username = profile.workspace_email.split('@')[0]
  const firstName = profile.first_name || 'Athlete'
  const lastName = profile.last_name || userId.slice(0, 6)

  try {
    let accountKey: string
    try {
      accountKey = await provisionZohoAccount(username, firstName, lastName)
    } catch (provisionErr) {
      const msg = String(provisionErr)
      // If the account already exists in Zoho, look it up by email
      if (msg.includes('Email Id already added') || msg.includes('1000')) {
        const token = await getZohoAccessToken()
        const listRes = await fetch(
          `https://mail360.zoho.com/api/accounts?limit=200`,
          { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        )
        const listData = await listRes.json()
        // Return raw structure so we can see what Zoho gives us
        return NextResponse.json({ debug: true, listData }, { status: 200 })
      } else {
        throw provisionErr
      }
    }

    await admin
      .from('profiles')
      .update({ zoho_account_key: accountKey })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      email: profile.workspace_email,
      accountKey,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
