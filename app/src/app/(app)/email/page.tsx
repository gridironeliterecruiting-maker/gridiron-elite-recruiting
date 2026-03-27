import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeProposedEmail, provisionZohoAccount } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { EmailClient } from './email-client'

export default async function EmailPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, zoho_account_key, first_name, last_name, jersey_number, grad_year')
    .eq('id', user.id)
    .single()

  let recruitingEmail: string | null = (profile as any)?.workspace_email || null

  // If no workspace email yet, auto-provision the Zoho mailbox now.
  // Never display a proposed/fake address — only show a real provisioned one.
  if (!recruitingEmail && profile?.first_name && profile?.last_name) {
    try {
      const proposedEmail = await computeProposedEmail(
        profile.first_name,
        profile.last_name,
        (profile as any).jersey_number,
        (profile as any).grad_year,
      )
      const username = proposedEmail.split('@')[0]
      const accountKey = await provisionZohoAccount(username, profile.first_name, profile.last_name)

      await admin
        .from('profiles')
        .update({ workspace_email: proposedEmail, zoho_account_key: accountKey })
        .eq('id', user.id)

      recruitingEmail = proposedEmail
    } catch (err) {
      console.error('[email/page] Failed to auto-provision Zoho account:', err)
      // Provisioning failed — show no email rather than a fake one
      recruitingEmail = null
    }
  }

  // Fetch initial inbox data server-side and pass as props
  // This follows the Supabase documented pattern: server fetches data,
  // client only handles Realtime subscription
  let initialThreads: any[] = []
  let initialUnreadCount = 0

  if ((profile as any)?.zoho_account_key) {
    try {
      const { getZohoFolders, findFolderId, zohoFetch } = await import('@/lib/workspace')
      const ZOHO_API_BASE = 'https://mail360.zoho.com/api'
      const accountKey = (profile as any).zoho_account_key as string
      const workspaceEmail = (recruitingEmail || '').toLowerCase()

      const folders = await getZohoFolders(accountKey)
      const inboxFolderId = findFolderId(folders, 'inbox')

      if (inboxFolderId) {
        const inboxRes = await zohoFetch(
          `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`,
          {}
        )

        if (inboxRes.ok) {
          const inboxData = await inboxRes.json()
          if (!inboxData?.status?.code || inboxData.status.code === 200) {
            const inboxMessages: any[] = inboxData?.data || []

            // Group inbox messages into conversations
            const parseFrom = (fromRaw: string) => {
              const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
              const name = match ? match[1].trim().replace(/^"|"$/g, '') : fromRaw
              const email = match ? match[2] : fromRaw
              return { name: name || email, email }
            }

            const normalizeSubject = (subject: string) =>
              subject.replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '').trim().toLowerCase()

            const conversationMap = new Map<string, any[]>()
            for (const msg of inboxMessages) {
              const normalizedSubject = normalizeSubject(msg.subject || '')
              const { email: fromEmail } = parseFrom(msg.fromAddress || '')
              const key = `${fromEmail.toLowerCase()}::${normalizedSubject}`
              const existing = conversationMap.get(key) || []
              existing.push(msg)
              conversationMap.set(key, existing)
            }

            const threads = Array.from(conversationMap.entries()).map(([, msgs]) => {
              msgs.sort((a: any, b: any) => {
                const aMs = parseInt(a.receivedTime || '0', 10)
                const bMs = parseInt(b.receivedTime || '0', 10)
                return bMs - aMs
              })
              const latest = msgs[0]
              const fromRaw = latest.fromAddress || latest.sender || ''
              const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
              const receivedMs = parseInt(latest.receivedTime || latest.sentDateInGMT || '0', 10)
              const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()
              const otherEmail = fromEmail.toLowerCase()
              const otherName = fromName || fromEmail
              const unreadMsgs = msgs.filter((m: any) => String(m.status) === '0')

              return {
                threadId: String(latest.messageId || ''),
                subject: latest.subject || '(No subject)',
                latestAt,
                otherName: otherName || otherEmail,
                otherEmail,
                snippet: latest.summary || '',
                unreadCount: unreadMsgs.length,
                messageCount: msgs.length,
                hasUnread: unreadMsgs.length > 0,
                latestReceivedId: String(latest.messageId || ''),
                logoUrl: null as string | null,
                schoolName: null as string | null,
              }
            }).filter(t => t.otherEmail && t.otherEmail !== workspaceEmail)
              .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

            // Batch logo + coach name lookup
            const otherEmails = [...new Set(threads.map(t => t.otherEmail).filter(Boolean))]
            if (otherEmails.length > 0) {
              const { data: coachRows } = await admin
                .from('coaches')
                .select('email, first_name, last_name, programs(logo_url, school_name)')
                .in('email', otherEmails)

              if (coachRows) {
                const coachMap = new Map<string, { logoUrl: string | null; schoolName: string | null; coachName: string | null }>()
                for (const row of coachRows as any[]) {
                  const prog = Array.isArray(row.programs) ? row.programs[0] : row.programs
                  const coachName = [row.first_name, row.last_name].filter(Boolean).join(' ') || null
                  coachMap.set(row.email?.toLowerCase() || '', {
                    logoUrl: prog?.logo_url || null,
                    schoolName: prog?.school_name || null,
                    coachName,
                  })
                }
                for (const thread of threads) {
                  const entry = coachMap.get(thread.otherEmail)
                  if (entry) {
                    thread.logoUrl = entry.logoUrl
                    thread.schoolName = entry.schoolName
                    if (entry.coachName) thread.otherName = entry.coachName
                  }
                }
              }
            }

            initialThreads = threads
            initialUnreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0)
          }
        }
      }
    } catch (err) {
      console.error('[email/page] Failed to load initial inbox:', err)
    }
  }

  return <EmailClient recruitingEmail={recruitingEmail} initialThreads={initialThreads} initialUnreadCount={initialUnreadCount} />
}
