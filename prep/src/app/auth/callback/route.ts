import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'

// Pass all params to the client-side exchange page.
// The browser client has the PKCE code_verifier in its own cookie storage;
// the server-side client can't reliably read it across the OAuth redirect chain.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const appUrl = getAppUrl(request)
  const params = searchParams.toString()
  return NextResponse.redirect(`${appUrl}/auth/exchange${params ? '?' + params : ''}`)
}
