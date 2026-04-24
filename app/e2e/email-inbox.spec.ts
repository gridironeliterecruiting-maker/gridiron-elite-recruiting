import { test, expect } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Inbox regression suite.
 *
 * The `/api/email/inbox` endpoint has burned us before. After the 2026-04-20
 * lint cleanup touched this file (type-only, no runtime logic), we added
 * these tests as a permanent safety net.
 *
 * Two tests:
 *   1. Endpoint-health — authenticated user, no Zoho configured, expects
 *      the short-circuit branch (line 83 of route.ts) to return empty
 *      arrays and a 200. This exercises auth + response shape.
 *   2. Grouping-algorithm — runs the exact grouping logic used inside
 *      the route against synthetic Zoho payloads, asserting the thread
 *      shape it produces. Locks in behavior that's hard to reach via
 *      real HTTP because the server-side fetch hits real Zoho.
 */

test.describe('email inbox — endpoint health', () => {
  test('authenticated user without Zoho returns empty-inbox shape', async ({ page, request }) => {
    await signInAs(page, 'athlete1')

    // Reuse the browser's session cookie for the API call.
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.get('/api/email/inbox', {
      headers: { cookie: cookieHeader },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    // Exact short-circuit shape from app/src/app/api/email/inbox/route.ts.
    expect(body).toEqual({
      threads: [],
      archivedThreads: [],
      unreadCount: 0,
    })
  })
})

/**
 * Synthetic Zoho-shaped messages matching the ZohoMessage interface in
 * app/src/app/api/email/inbox/route.ts. Mirrors the Mail360 "messages"
 * endpoint payload.
 */
interface ZohoMessage {
  messageId?: string | number
  subject?: string
  summary?: string
  fromAddress?: string
  toAddress?: string
  sender?: string
  receivedTime?: string
  sentDateInGMT?: string
  status?: string | number
}

/**
 * Duplicates the exact parseFrom + normalizeSubject + grouping algorithm
 * from route.ts. If this algorithm ever diverges from the route, THIS
 * copy is the reference — update route.ts to match, not the other way.
 */
function parseFrom(fromRaw: string): { name: string; email: string } {
  if (!fromRaw) return { name: '', email: '' }
  const s = fromRaw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
  const rfcMatch = s.match(/^(.*?)\s*<([^>@\s]+@[^>]+)>/)
  if (rfcMatch) {
    const name = rfcMatch[1].trim().replace(/^"|"$/g, '')
    const email = rfcMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }
  const zohoMatch = s.match(/^<([^>]*)>(.+@.+)$/)
  if (zohoMatch) {
    const name = zohoMatch[1].trim()
    const email = zohoMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }
  const plain = s.trim().toLowerCase()
  return { name: plain, email: plain }
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '')
    .trim()
    .toLowerCase()
}

function groupIntoThreads(
  inboxMessages: ZohoMessage[],
  sentMessages: ZohoMessage[],
  workspaceEmail: string,
) {
  const conversationMap = new Map<string, { inbox: ZohoMessage[]; sent: ZohoMessage[] }>()

  for (const msg of inboxMessages) {
    const normalizedSubject = normalizeSubject(msg.subject || '')
    const { email: fromEmail } = parseFrom(msg.fromAddress || '')
    const key = `${fromEmail.toLowerCase()}::${normalizedSubject}`
    const existing = conversationMap.get(key) || { inbox: [], sent: [] }
    existing.inbox.push(msg)
    conversationMap.set(key, existing)
  }

  for (const msg of sentMessages) {
    const normalizedSubject = normalizeSubject(msg.subject || '')
    const toRaw = (msg.toAddress || '').split(',')[0].trim()
    const { email: toEmail } = parseFrom(toRaw)
    const key = `${toEmail.toLowerCase()}::${normalizedSubject}`
    const existing = conversationMap.get(key)
    if (existing) existing.sent.push(msg)
  }

  const threads = Array.from(conversationMap.entries()).map(([, conv]) => {
    const allMsgs = [...conv.inbox, ...conv.sent]
    allMsgs.sort((a, b) => {
      const aMs = parseInt(a.receivedTime || a.sentDateInGMT || '0', 10)
      const bMs = parseInt(b.receivedTime || b.sentDateInGMT || '0', 10)
      return bMs - aMs
    })
    const latest = allMsgs[0]

    const latestInbox = conv.inbox.sort((a, b) => {
      const aMs = parseInt(a.receivedTime || '0', 10)
      const bMs = parseInt(b.receivedTime || '0', 10)
      return bMs - aMs
    })[0]

    const fromRaw = latestInbox?.fromAddress || latestInbox?.sender || latest.fromAddress || latest.sender || ''
    const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
    const latestFromRaw = latest.fromAddress || latest.sender || ''
    const { email: latestFromEmail } = parseFrom(latestFromRaw)
    const latestIsMine = latestFromEmail.toLowerCase() === workspaceEmail

    let otherEmail: string
    let otherName: string
    if (latestIsMine && latestInbox) {
      otherEmail = fromEmail.toLowerCase()
      otherName = fromName || fromEmail
    } else {
      const { name, email } = parseFrom(latestFromRaw)
      otherEmail = email.toLowerCase()
      otherName = name || email
    }

    const unreadMsgs = conv.inbox.filter((m) => String(m.status) === '0')

    return {
      subject: latest.subject || '(No subject)',
      otherName: otherName || otherEmail,
      otherEmail,
      unreadCount: unreadMsgs.length,
      messageCount: allMsgs.length,
      hasUnread: unreadMsgs.length > 0,
    }
  }).filter(t => t.otherEmail && t.otherEmail !== workspaceEmail)

  return threads
}

test.describe('email inbox — grouping algorithm', () => {
  const workspaceEmail = 'alex.athlete@jetstreammail.com'

  test('groups replies from the same coach by normalized subject', () => {
    const inbox: ZohoMessage[] = [
      {
        messageId: '1',
        subject: 'Re: Interested in your program',
        fromAddress: 'Coach Smith <coach.smith@stanford.edu>',
        receivedTime: '1712000000000',
        status: '0',
      },
      {
        messageId: '2',
        subject: 'RE: Interested in your program',
        fromAddress: 'coach.smith@stanford.edu',
        receivedTime: '1712100000000',
        status: '1',
      },
    ]
    const sent: ZohoMessage[] = [
      {
        messageId: 's1',
        subject: 'Interested in your program',
        toAddress: 'coach.smith@stanford.edu',
        sentDateInGMT: '1711900000000',
      },
    ]

    const threads = groupIntoThreads(inbox, sent, workspaceEmail)
    expect(threads).toHaveLength(1)
    expect(threads[0].otherEmail).toBe('coach.smith@stanford.edu')
    expect(threads[0].messageCount).toBe(3) // 2 inbox + 1 sent
    expect(threads[0].unreadCount).toBe(1) // only status='0'
  })

  test('keeps separate threads for different coaches with identical subjects', () => {
    const inbox: ZohoMessage[] = [
      {
        messageId: '1',
        subject: 'Interested',
        fromAddress: 'a@stanford.edu',
        receivedTime: '1712000000000',
        status: '0',
      },
      {
        messageId: '2',
        subject: 'Interested',
        fromAddress: 'b@michigan.edu',
        receivedTime: '1712000000000',
        status: '0',
      },
    ]
    const threads = groupIntoThreads(inbox, [], workspaceEmail)
    expect(threads).toHaveLength(2)
    const emails = threads.map(t => t.otherEmail).sort()
    expect(emails).toEqual(['a@stanford.edu', 'b@michigan.edu'])
  })

  test('matches sent message to correct inbox thread and counts unread', () => {
    const inbox: ZohoMessage[] = [
      {
        messageId: 'i1',
        subject: 'Re: Visit invite',
        fromAddress: 'coach@ucla.edu',
        receivedTime: '1712000000000',
        status: '0', // unread
      },
    ]
    const sent: ZohoMessage[] = [
      {
        messageId: 's1',
        subject: 'Visit invite',
        toAddress: 'coach@ucla.edu',
        sentDateInGMT: '1711900000000',
      },
      {
        messageId: 's2',
        subject: 'Completely unrelated',
        toAddress: 'other@elsewhere.edu',
        sentDateInGMT: '1711800000000',
      },
    ]
    const threads = groupIntoThreads(inbox, sent, workspaceEmail)
    expect(threads).toHaveLength(1) // sent-only threads must not appear
    expect(threads[0].otherEmail).toBe('coach@ucla.edu')
    expect(threads[0].messageCount).toBe(2) // one inbox + one matched sent
    expect(threads[0].unreadCount).toBe(1)
    expect(threads[0].hasUnread).toBe(true)
  })

  test('filters out threads where the other party IS the user', () => {
    // This shouldn't normally happen, but the defensive filter is there.
    const inbox: ZohoMessage[] = [
      {
        messageId: '1',
        subject: 'Self-loop',
        fromAddress: workspaceEmail,
        receivedTime: '1712000000000',
        status: '1',
      },
    ]
    const threads = groupIntoThreads(inbox, [], workspaceEmail)
    expect(threads).toHaveLength(0)
  })

  test('handles Zoho HTML-encoded angle brackets in sent folder', () => {
    const inbox: ZohoMessage[] = [
      {
        messageId: 'i1',
        subject: 'Re: Film question',
        fromAddress: 'Coach Test <ctest@ohio.edu>',
        receivedTime: '1712000000000',
        status: '1',
      },
    ]
    const sent: ZohoMessage[] = [
      {
        messageId: 's1',
        subject: 'Film question',
        // This is Zoho's sent-folder format — encoded angle brackets
        toAddress: 'Coach Test &lt;ctest@ohio.edu&gt;',
        sentDateInGMT: '1711900000000',
      },
    ]
    const threads = groupIntoThreads(inbox, sent, workspaceEmail)
    expect(threads).toHaveLength(1)
    expect(threads[0].messageCount).toBe(2) // sent must match despite encoding
  })
})
