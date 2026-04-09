import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleHoneypotDetection } from '@/lib/scanner-detection'

// 1x1 transparent GIF — returned to look like an image to scanners
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

/**
 * Honeypot endpoint — only email security scanners hit this.
 *
 * The link is invisible to humans (0-size, transparent, no text).
 * When triggered:
 * 1. Flags the recipient with scanner_detected_at
 * 2. Deletes any scanner-generated opens/clicks (within 3 min of send)
 * 3. Runs cohort analysis to detect domain-wide scanner patterns
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('rid')
  const campaignId = searchParams.get('cid')

  if (recipientId && campaignId) {
    const admin = createAdminClient()
    // Fire and forget — don't block the response
    handleHoneypotDetection(admin, recipientId, campaignId).catch(() => {})
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
