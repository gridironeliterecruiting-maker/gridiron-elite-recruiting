import { NextResponse } from 'next/server'

/**
 * Reply detection disabled — gmail.readonly scope removed pending Google OAuth verification.
 * Will be re-enabled once verification is approved.
 */
export async function GET() {
  return NextResponse.json({ replies: 0, message: 'Reply detection disabled pending Google OAuth verification.' })
}
