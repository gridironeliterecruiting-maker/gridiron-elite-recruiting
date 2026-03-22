import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

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
  if (!accountKey) return NextResponse.json({ error: 'No account key' })

  const folders = await getZohoFolders(accountKey)
  const inboxFolderId = findFolderId(folders, 'inbox')
  const sentFolderId = findFolderId(folders, 'sent', 'sent items', 'sent mail')

  const [inboxRes, sentRes] = await Promise.all([
    inboxFolderId ? zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=10`, {}) : null,
    sentFolderId ? zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${sentFolderId}&limit=5`, {}) : null,
  ])

  const inboxData = inboxRes ? await inboxRes.json() : null
  const sentData = sentRes ? await sentRes.json() : null

  const inboxSample = (inboxData?.data || []).slice(0, 3)
  const sentSample = (sentData?.data || []).slice(0, 2)

  return NextResponse.json({
    inboxFolderId,
    sentFolderId,
    inbox_sample: inboxSample,
    sent_sample: sentSample,
  })
}
