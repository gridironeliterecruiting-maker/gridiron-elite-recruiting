import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Look up the numeric folderId for the Inbox folder on a given account.
 * Zoho Mail360 requires folderId (numeric) — "folder=Inbox" is not valid.
 */
async function getInboxFolderId(accountKey: string): Promise<string | null> {
  const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/folders`, {})
  if (!res.ok) {
    const err = await res.text()
    console.error('[email/inbox] Zoho folders error:', res.status, err)
    return null
  }
  const data = await res.json()
  const folders: any[] = data.data || []
  if (folders.length === 0) {
    console.error('[email/inbox] Zoho returned no folders for account:', accountKey)
    return null
  }
  // Find the Inbox — Zoho uses folderName or name, and folderType or type for identification
  const inbox = folders.find((f: any) =>
    f.folderName?.toLowerCase() === 'inbox' ||
    f.name?.toLowerCase() === 'inbox' ||
    f.folderType?.toLowerCase() === 'inbox' ||
    f.type?.toLowerCase() === 'inbox'
  )
  if (!inbox) {
    // Log all folder names to diagnose
    const names = folders.map((f: any) => f.folderName || f.name || JSON.stringify(f)).join(', ')
    console.error('[email/inbox] Inbox folder not found. Available folders:', names)
    return null
  }
  return String(inbox.folderId || inbox.id || '')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, zoho_account_key')
    .eq('id', user.id)
    .single()

  const accountKey = (profile as any)?.zoho_account_key as string | null
  if (!accountKey) {
    return NextResponse.json({ items: [], unreadCount: 0 })
  }

  try {
    // Step 1: Get the Inbox folder ID (Zoho requires numeric folderId, not folder name)
    const folderId = await getInboxFolderId(accountKey)
    if (!folderId) {
      return NextResponse.json({ items: [], unreadCount: 0 })
    }

    // Step 2: Fetch messages using correct folderId parameter + zohoFetch (auto-retry on token expiry)
    const listRes = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${folderId}&limit=25`,
      {}
    )

    if (!listRes.ok) {
      const err = await listRes.text()
      console.error('[email/inbox] Zoho messages error:', listRes.status, err)
      return NextResponse.json({ items: [], unreadCount: 0 })
    }

    const listData = await listRes.json()
    const messages: any[] = listData.data || []

    if (messages.length === 0) {
      return NextResponse.json({ items: [], unreadCount: 0 })
    }

    const items = messages.map((m: any) => {
      const fromRaw: string = m.fromAddress || m.from_address || ''
      const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
      const fromName = match ? match[1].trim().replace(/^"|"$/g, '') : fromRaw
      const fromEmail = match ? match[2] : fromRaw

      const receivedMs = parseInt(m.receivedTime || m.received_time || '0', 10)
      const receivedAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      return {
        id: m.messageId || m.message_id || '',
        thread_id: m.threadId || m.thread_id || m.messageId || m.message_id || '',
        from_name: fromName || fromEmail,
        from_email: fromEmail,
        subject: m.subject || '(No subject)',
        snippet: m.summary || m.snippet || '',
        received_at: receivedAt,
        is_read: m.isRead ?? m.is_read ?? true,
      }
    })

    const unreadCount = items.filter((i) => !i.is_read).length
    return NextResponse.json({ items, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ items: [], unreadCount: 0 })
  }
}
