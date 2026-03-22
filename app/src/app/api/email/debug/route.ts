import { NextRequest, NextResponse } from 'next/server'
import { zohoFetch, getZohoFolders } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'
const TEST_ACCOUNT_KEY = 'KzI777I80zt'
const TEST_EMAIL = 'caelkongshaug@jetstreammail.com'
const SECRET = 'runway_debug_2026'
// Deterministic password for testing — will be replaced with crypto.randomUUID() in prod
const TEST_PASSWORD = 'RunwayTest2026!Xyz'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const step = searchParams.get('step') || 'diagnose'
  const results: Record<string, any> = { step }

  const accountKey = searchParams.get('accountKey') || TEST_ACCOUNT_KEY

  if (step === 'diagnose') {
    // Original diagnostic — check current state
    await runDiagnose(accountKey, results)
  } else if (step === 'set-password') {
    // Step 1: Set password on the existing HOSTED_ACCOUNT
    await runSetPassword(results)
  } else if (step === 'create-sync') {
    // Step 2: Create an IMAP sync account pointing to Zoho's own IMAP
    await runCreateSync(results)
  } else if (step === 'test-sync') {
    // Step 3: Test threads on the sync account
    const syncKey = searchParams.get('syncKey')
    if (!syncKey) {
      results.error = 'syncKey query param required'
    } else {
      await runTestSync(syncKey, results)
    }
  } else if (step === 'delete-and-recreate') {
    // Delete existing hosted account, then create sync account
    await runDeleteAndRecreate(results)
  } else if (step === 'recreate-hosted') {
    // Recreate Cael's hosted account after deletion
    await runRecreateHosted(results)
  } else if (step === 'send-test') {
    // Send a test email to create conversation material for threading test
    await runSendTest(accountKey, results)
  } else if (step === 'test-zohomail') {
    // Test if Zoho Mail API (different from Mail360) supports threading
    await runTestZohoMail(accountKey, results)
  } else if (step === 'list-accounts') {
    // List all accounts to see what exists
    await runListAccounts(results)
  } else {
    results.error = `Unknown step: ${step}. Use: diagnose, set-password, create-sync, test-sync, list-accounts`
  }

  return NextResponse.json(results, { status: 200 })
}

async function runDiagnose(acctKey: string, results: Record<string, any>) {
  results.accountKeyUsed = acctKey

  // 1. Get folders
  try {
    const folders = await getZohoFolders(acctKey)
    results.folders = folders.map((f: any) => ({ name: f.folderName, id: f.folderId, type: f.folderType }))
    const inboxFolder = folders.find((f: any) =>
      (f.folderName || '').toLowerCase() === 'inbox' ||
      (f.folderType || '').toLowerCase() === 'inbox'
    )
    results.inboxFolderId = inboxFolder ? String(inboxFolder.folderId || '') : null
  } catch (e: any) {
    results.foldersError = e?.message || String(e)
  }

  const inboxFolderId = results.inboxFolderId

  // 2. Messages in inbox
  if (inboxFolderId) {
    try {
      const msgUrl = `${ZOHO_API_BASE}/accounts/${acctKey}/messages?folderId=${inboxFolderId}&limit=5`
      const msgRes = await zohoFetch(msgUrl, {})
      const msgData = await msgRes.json()
      results.inboxMessages = {
        count: msgData?.data?.length ?? 0,
        firstItemKeys: msgData?.data?.[0] ? Object.keys(msgData.data[0]) : [],
        firstItem: msgData?.data?.[0] || null,
      }
    } catch (e: any) {
      results.inboxMessagesError = e?.message || String(e)
    }
  }

  // 2b. Messages in sent folder
  try {
    const folders = await getZohoFolders(acctKey)
    const sentFolder = folders.find((f: any) =>
      (f.folderName || '').toLowerCase() === 'sent' ||
      (f.folderType || '').toLowerCase() === 'sent'
    )
    if (sentFolder) {
      const sentId = String(sentFolder.folderId || '')
      const msgUrl = `${ZOHO_API_BASE}/accounts/${acctKey}/messages?folderId=${sentId}&limit=5`
      const msgRes = await zohoFetch(msgUrl, {})
      const msgData = await msgRes.json()
      results.sentMessages = {
        count: msgData?.data?.length ?? 0,
        firstItemKeys: msgData?.data?.[0] ? Object.keys(msgData.data[0]) : [],
        firstItem: msgData?.data?.[0] || null,
      }
    }
  } catch (e: any) {
    results.sentMessagesError = e?.message || String(e)
  }

  // 3. Threads with inbox folderId
  if (inboxFolderId) {
    try {
      const thrUrl = `${ZOHO_API_BASE}/accounts/${acctKey}/threads?folderId=${inboxFolderId}&limit=50`
      const thrRes = await zohoFetch(thrUrl, {})
      const thrData = await thrRes.json()
      results.threadsInbox = {
        count: thrData?.data?.length ?? 0,
        firstItem: thrData?.data?.[0] || null,
        firstItemKeys: thrData?.data?.[0] ? Object.keys(thrData.data[0]) : [],
        fullResponse: thrData,
      }
    } catch (e: any) {
      results.threadsInboxError = e?.message || String(e)
    }
  }

  // 3b. Threads without folderId (all folders)
  try {
    const thrUrl = `${ZOHO_API_BASE}/accounts/${acctKey}/threads?limit=50&includesent=true`
    const thrRes = await zohoFetch(thrUrl, {})
    const thrData = await thrRes.json()
    results.threadsAll = {
      count: thrData?.data?.length ?? 0,
      firstItem: thrData?.data?.[0] || null,
      firstItemKeys: thrData?.data?.[0] ? Object.keys(thrData.data[0]) : [],
      fullResponse: thrData,
    }
  } catch (e: any) {
    results.threadsAllError = e?.message || String(e)
  }

  // 4. Account info
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${acctKey}`, {})
    const data = await res.json()
    results.accountInfo = data?.data || null
  } catch (e: any) {
    results.accountInfoError = e?.message || String(e)
  }
}

async function runSetPassword(results: Record<string, any>) {
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'updatePassword',
        newPassword: TEST_PASSWORD,
      }),
    })
    const data = await res.json()
    results.setPassword = {
      httpStatus: res.status,
      response: data,
    }
  } catch (e: any) {
    results.setPasswordError = e?.message || String(e)
  }
}

async function runCreateSync(results: Record<string, any>) {
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountType: '2',
        emailid: TEST_EMAIL,
        displayName: 'Cael Kongshaug (sync)',
        incomingUser: TEST_EMAIL,
        incomingPasswd: TEST_PASSWORD,
        incomingServer: 'imappro.zoho.com',
        incomingServerPort: '993',
        sslEnabled: true,
        outgoingServer: 'smtppro.zoho.com',
        outgoingServerPort: '465',
        smtpConnection: '1', // 0=PLAIN, 1=SSL, 2=TLS
        outgoingUser: TEST_EMAIL,
        outgoingPasswd: TEST_PASSWORD,
      }),
    })
    const data = await res.json()
    results.createSync = {
      httpStatus: res.status,
      response: data,
      newAccountKey: data?.data?.account_key || null,
    }
  } catch (e: any) {
    results.createSyncError = e?.message || String(e)
  }
}

async function runTestSync(syncKey: string, results: Record<string, any>) {
  // 1. Account info for the sync account
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${syncKey}`, {})
    const data = await res.json()
    results.syncAccountInfo = data?.data || null
  } catch (e: any) {
    results.syncAccountInfoError = e?.message || String(e)
  }

  // 2. Folders
  try {
    const folders = await getZohoFolders(syncKey)
    results.syncFolders = folders.map((f: any) => ({ name: f.folderName, id: f.folderId, type: f.folderType }))
    const inboxFolder = folders.find((f: any) =>
      (f.folderName || '').toLowerCase() === 'inbox' ||
      (f.folderType || '').toLowerCase() === 'inbox'
    )
    results.syncInboxFolderId = inboxFolder ? String(inboxFolder.folderId || '') : null
  } catch (e: any) {
    results.syncFoldersError = e?.message || String(e)
  }

  // 3. Messages on sync account
  const inboxFolderId = results.syncInboxFolderId
  if (inboxFolderId) {
    try {
      const msgUrl = `${ZOHO_API_BASE}/accounts/${syncKey}/messages?folderId=${inboxFolderId}&limit=5`
      const msgRes = await zohoFetch(msgUrl, {})
      const msgData = await msgRes.json()
      results.syncMessages = {
        count: msgData?.data?.length ?? 0,
        firstItemKeys: msgData?.data?.[0] ? Object.keys(msgData.data[0]) : [],
      }
    } catch (e: any) {
      results.syncMessagesError = e?.message || String(e)
    }
  }

  // 4. Threads on sync account — THE KEY TEST
  if (inboxFolderId) {
    try {
      const thrUrl = `${ZOHO_API_BASE}/accounts/${syncKey}/threads?folderId=${inboxFolderId}&limit=50`
      const thrRes = await zohoFetch(thrUrl, {})
      const thrData = await thrRes.json()
      results.syncThreads = {
        count: thrData?.data?.length ?? 0,
        firstItem: thrData?.data?.[0] || null,
        firstItemKeys: thrData?.data?.[0] ? Object.keys(thrData.data[0]) : [],
        fullResponse: thrData,
      }
    } catch (e: any) {
      results.syncThreadsError = e?.message || String(e)
    }
  }

  // 5. Threads without folderId
  try {
    const thrUrl = `${ZOHO_API_BASE}/accounts/${syncKey}/threads?limit=50`
    const thrRes = await zohoFetch(thrUrl, {})
    const thrData = await thrRes.json()
    results.syncThreadsNoFolder = {
      count: thrData?.data?.length ?? 0,
      firstItem: thrData?.data?.[0] || null,
      fullResponse: thrData,
    }
  } catch (e: any) {
    results.syncThreadsNoFolderError = e?.message || String(e)
  }
}

async function runDeleteAndRecreate(results: Record<string, any>) {
  // Step 1: Delete the existing hosted account
  try {
    const delRes = await zohoFetch(`${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}`, {
      method: 'DELETE',
    })
    const delData = await delRes.json().catch(() => ({}))
    results.deleteHosted = {
      httpStatus: delRes.status,
      response: delData,
    }
  } catch (e: any) {
    results.deleteHostedError = e?.message || String(e)
    return // Don't proceed if delete fails
  }

  // Step 2: Wait a moment for deletion to propagate
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Step 3: Create sync account (accountType: 2) pointing to Zoho IMAP
  try {
    const createRes = await zohoFetch(`${ZOHO_API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountType: '2',
        emailid: TEST_EMAIL,
        displayName: 'Cael Kongshaug',
        incomingUser: TEST_EMAIL,
        incomingPasswd: TEST_PASSWORD,
        incomingServer: 'imappro.zoho.com',
        incomingServerPort: '993',
        sslEnabled: true,
        outgoingServer: 'smtppro.zoho.com',
        outgoingServerPort: '465',
        smtpConnection: '1', // SSL
        outgoingUser: TEST_EMAIL,
        outgoingPasswd: TEST_PASSWORD,
      }),
    })
    const createData = await createRes.json()
    results.createSync = {
      httpStatus: createRes.status,
      response: createData,
      newAccountKey: createData?.data?.account_key || null,
    }
  } catch (e: any) {
    results.createSyncError = e?.message || String(e)
  }
}

async function runRecreateHosted(results: Record<string, any>) {
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountType: '1',
        emailid: TEST_EMAIL,
        displayName: 'Cael Kongshaug',
      }),
    })
    const data = await res.json()
    results.recreateHosted = {
      httpStatus: res.status,
      response: data,
      newAccountKey: data?.data?.account_key || null,
    }
  } catch (e: any) {
    results.recreateHostedError = e?.message || String(e)
  }
}

async function runSendTest(accountKey: string, results: Record<string, any>) {
  // Send a test email from Cael's account to Paul, then send a reply from Paul back
  // This creates a multi-message conversation for threading test
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddress: TEST_EMAIL,
        toAddress: 'paulkongshaug@gmail.com',
        subject: 'Threading test conversation',
        content: 'This is a test message to verify Zoho threads API works for hosted accounts. Please reply to create a thread.',
      }),
    })
    const data = await res.json()
    results.sendTest = {
      httpStatus: res.status,
      response: data,
    }
  } catch (e: any) {
    results.sendTestError = e?.message || String(e)
  }
}

async function runTestZohoMail(acctKey: string, results: Record<string, any>) {
  // Try the Zoho Mail API (mail.zoho.com) instead of Mail360 (mail360.zoho.com)
  // These are different products — Zoho Mail has native threading for Workspace users
  const ZOHO_MAIL_BASE = 'https://mail.zoho.com/api'

  // 1. Try listing accounts via Zoho Mail API
  try {
    const res = await zohoFetch(`${ZOHO_MAIL_BASE}/accounts`, {})
    const data = await res.json()
    results.zohoMailAccounts = {
      httpStatus: res.status,
      response: data,
    }
  } catch (e: any) {
    results.zohoMailAccountsError = e?.message || String(e)
  }

  // 2. Try Mail360 threads API with the sent folder explicitly
  try {
    const folders = await getZohoFolders(acctKey)
    const sentFolder = folders.find((f: any) =>
      (f.folderName || '').toLowerCase() === 'sent'
    )
    if (sentFolder) {
      const sentId = String(sentFolder.folderId || '')
      const thrUrl = `${ZOHO_API_BASE}/accounts/${acctKey}/threads?folderId=${sentId}&limit=50`
      const thrRes = await zohoFetch(thrUrl, {})
      const thrData = await thrRes.json()
      results.threadsSent = {
        count: thrData?.data?.length ?? 0,
        fullResponse: thrData,
      }
    }
  } catch (e: any) {
    results.threadsSentError = e?.message || String(e)
  }

  // 3. Try the Zoho Mail API threads endpoint directly
  try {
    // Zoho Mail API uses numeric accountId, not string account_key
    // Let's try with the account_key anyway to see what happens
    const thrUrl = `${ZOHO_MAIL_BASE}/accounts/${acctKey}/threads?limit=50`
    const thrRes = await zohoFetch(thrUrl, {})
    const thrData = await thrRes.json()
    results.zohoMailThreads = {
      httpStatus: thrRes.status,
      response: thrData,
    }
  } catch (e: any) {
    results.zohoMailThreadsError = e?.message || String(e)
  }
}

async function runListAccounts(results: Record<string, any>) {
  try {
    const res = await zohoFetch(`${ZOHO_API_BASE}/accounts`, {})
    const data = await res.json()
    results.accounts = data?.data || data
  } catch (e: any) {
    results.accountsError = e?.message || String(e)
  }
}
