import { NextResponse } from 'next/server'

/**
 * Reply detection removed — gmail.readonly is a restricted scope requiring CASA security
 * audit. Not worth the cost. This endpoint is intentionally a no-op.
 */
export async function GET() {
  return NextResponse.json({ replies: 0, message: 'Reply detection disabled pending Google OAuth verification.' })
}
