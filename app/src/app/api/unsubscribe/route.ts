import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const campaignId = searchParams.get('cid')

  if (!email) {
    return new NextResponse(unsubscribePage('Invalid unsubscribe link.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const admin = createAdminClient()

    // Add to unsubscribes table
    await admin.from('unsubscribes').upsert(
      {
        email,
        campaign_id: campaignId || null,
      },
      { onConflict: 'email' }
    )

    // Update any pending/scheduled recipients with this email
    await admin
      .from('campaign_recipients')
      .update({ status: 'unsubscribed' })
      .eq('coach_email', email)
      .in('status', ['pending', 'scheduled'])

    return new NextResponse(
      unsubscribePage('You have been successfully unsubscribed. You will no longer receive emails from this campaign.', true),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return new NextResponse(
      unsubscribePage('Something went wrong. Please try again later.', false),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }
}

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribe - Runway Recruit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #111827; margin: 0 0 12px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Unsubscribed' : 'Error'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}
