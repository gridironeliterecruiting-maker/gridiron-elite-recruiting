import { NextRequest, NextResponse } from 'next/server'
import { zohoFetch, getZohoFolders } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'
// Cael's account for diagnostic testing
const TEST_ACCOUNT_KEY = 'KzI777I80zt'
const SECRET = 'runway_debug_2026'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const results: Record<string, any> = {}

  // 1. Get folders
  try {
    const folders = await getZohoFolders(TEST_ACCOUNT_KEY)
    results.folders = folders
    const inboxFolder = folders.find((f: any) =>
      (f.folderName || '').toLowerCase() === 'inbox' ||
      (f.folderType || '').toLowerCase() === 'inbox' ||
      (f.name || '').toLowerCase() === 'inbox'
    )
    results.inboxFolder = inboxFolder || null
    results.inboxFolderId = inboxFolder ? String(inboxFolder.folderId || inboxFolder.id || '') : null
  } catch (e: any) {
    results.foldersError = e?.message || String(e)
  }

  const inboxFolderId = results.inboxFolderId

  // 2. Messages API (known-working baseline)
  try {
    const msgUrl = inboxFolderId
      ? `${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}/messages?folderId=${inboxFolderId}&limit=5`
      : `${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}/messages?limit=5`
    const msgRes = await zohoFetch(msgUrl, {})
    const msgData = await msgRes.json()
    results.messages = {
      status: msgRes.status,
      url: msgUrl,
      statusCode: msgData?.status?.code,
      dataLength: msgData?.data?.length ?? null,
      firstItem: msgData?.data?.[0] || null,
      firstItemKeys: msgData?.data?.[0] ? Object.keys(msgData.data[0]) : [],
      rawStatus: msgData?.status,
    }
  } catch (e: any) {
    results.messagesError = e?.message || String(e)
  }

  // 3. Threads API with folderId
  if (inboxFolderId) {
    try {
      const thrUrl = `${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}/threads?folderId=${inboxFolderId}&limit=50`
      const thrRes = await zohoFetch(thrUrl, {})
      const thrData = await thrRes.json()
      results.threadsWithFolder = {
        status: thrRes.status,
        url: thrUrl,
        statusCode: thrData?.status?.code,
        dataLength: thrData?.data?.length ?? null,
        firstItem: thrData?.data?.[0] || null,
        firstItemKeys: thrData?.data?.[0] ? Object.keys(thrData.data[0]) : [],
        rawStatus: thrData?.status,
        fullResponse: thrData,
      }
    } catch (e: any) {
      results.threadsWithFolderError = e?.message || String(e)
    }
  }

  // 4. Threads API without folderId (default = all folders / -1)
  try {
    const thrUrl2 = `${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}/threads?limit=50`
    const thrRes2 = await zohoFetch(thrUrl2, {})
    const thrData2 = await thrRes2.json()
    results.threadsNoFolder = {
      status: thrRes2.status,
      url: thrUrl2,
      statusCode: thrData2?.status?.code,
      dataLength: thrData2?.data?.length ?? null,
      firstItem: thrData2?.data?.[0] || null,
      firstItemKeys: thrData2?.data?.[0] ? Object.keys(thrData2.data[0]) : [],
      rawStatus: thrData2?.status,
      fullResponse: thrData2,
    }
  } catch (e: any) {
    results.threadsNoFolderError = e?.message || String(e)
  }

  // 5. Threads API with includesent=true
  try {
    const thrUrl3 = `${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}/threads?limit=50&includesent=true`
    const thrRes3 = await zohoFetch(thrUrl3, {})
    const thrData3 = await thrRes3.json()
    results.threadsIncludeSent = {
      status: thrRes3.status,
      url: thrUrl3,
      statusCode: thrData3?.status?.code,
      dataLength: thrData3?.data?.length ?? null,
      firstItem: thrData3?.data?.[0] || null,
      rawStatus: thrData3?.status,
    }
  } catch (e: any) {
    results.threadsIncludeSentError = e?.message || String(e)
  }

  // 6. Get access token info (just check it's valid)
  try {
    const tokenCheckRes = await zohoFetch(`${ZOHO_API_BASE}/accounts/${TEST_ACCOUNT_KEY}`, {})
    const tokenCheckData = await tokenCheckRes.json()
    results.accountInfo = {
      status: tokenCheckRes.status,
      statusCode: tokenCheckData?.status?.code,
      data: tokenCheckData?.data || null,
    }
  } catch (e: any) {
    results.accountInfoError = e?.message || String(e)
  }

  return NextResponse.json(results, { status: 200 })
}
