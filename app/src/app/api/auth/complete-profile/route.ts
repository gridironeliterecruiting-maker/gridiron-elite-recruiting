import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { computeProposedEmail, provisionZohoAccount } from '@/lib/workspace'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      subscriptionId,
      plan,
      firstName,
      lastName,
      position,
      gradYear,
      jerseyNumber,
      highSchool,
      city,
      state,
      gpa,
      height,
      weight,
      hudlUrl,
      twitterHandle,
    } = body

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get authenticated user from session
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const userId = user.id

    let stripeCustomerId: string | null = null
    let currentPeriodEnd: string | null = null

    // Verify subscription if provided
    if (subscriptionId) {
      // Check that the subscription hasn't already been used
      const { data: existingSub } = await admin
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (existingSub) {
        return NextResponse.json({ error: 'This subscription has already been used' }, { status: 409 })
      }

      const stripe = getStripe()
      let stripeSub
      try {
        stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
      } catch {
        return NextResponse.json({ error: 'Invalid subscription ID' }, { status: 400 })
      }

      if (!['active', 'trialing', 'incomplete'].includes(stripeSub.status)) {
        return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
      }

      stripeCustomerId = typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id

      currentPeriodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null

      // Create subscription row
      await admin.from('subscriptions').insert({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        status: stripeSub.status === 'active' ? 'active' : 'incomplete',
        plan: plan || 'monthly',
        current_period_end: currentPeriodEnd,
      })
    }

    // Upsert profile row
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      position,
      grad_year: gradYear ? parseInt(gradYear) : null,
      jersey_number: jerseyNumber || null,
      high_school: highSchool,
      city,
      state,
      gpa: gpa ? parseFloat(gpa) : null,
      height: height || null,
      weight: weight ? parseInt(weight) : null,
      hudl_url: hudlUrl || null,
      twitter_handle: twitterHandle || null,
      ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
      is_grandfathered: false,
      registered_via: 'main_site',
    })

    if (profileError) {
      console.error('[complete-profile] Profile upsert failed:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Auto-provision Zoho recruiting email
    try {
      const workspaceEmail = await computeProposedEmail(
        firstName,
        lastName,
        jerseyNumber || undefined,
        gradYear ? parseInt(gradYear) : null,
      )
      const username = workspaceEmail.split('@')[0]
      const accountKey = await provisionZohoAccount(username, firstName, lastName)
      await admin.from('profiles').update({
        workspace_email: workspaceEmail,
        zoho_account_key: accountKey,
      }).eq('id', userId)
    } catch (err) {
      console.error('[complete-profile] Zoho provisioning failed (non-fatal):', err)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[complete-profile] Unexpected error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
