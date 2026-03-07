import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionWorkspaceAccount } from '@/lib/workspace'
import { getStripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      // Stripe session
      subscriptionId,
      email,       // recovery email (from checkout)
      plan,        // monthly | annual
      // Profile fields
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
      // Workspace auth
      username,
      password,
      recoveryEmail,
    } = body

    if (!subscriptionId || !firstName || !lastName || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify subscription exists and has a valid payment
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

    // Check that the subscription hasn't already been used to create an account
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single()

    if (existingSub) {
      return NextResponse.json({ error: 'This subscription has already been used to create an account' }, { status: 409 })
    }

    const workspaceEmail = `${username}@${process.env.GOOGLE_WORKSPACE_DOMAIN || 'flightschoolmail.com'}`

    // Provision Google Workspace account
    await provisionWorkspaceAccount(username, password, firstName, lastName)

    // Create Supabase auth user with the workspace email
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: workspaceEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (authError || !authData.user) {
      console.error('[complete-profile] Auth user creation failed:', authError)
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
    }

    const userId = authData.user.id
    const stripeCustomerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id

    // Upsert profile row
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      username,
      workspace_email: workspaceEmail,
      recovery_email: recoveryEmail || email,
      email: workspaceEmail,
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
      stripe_customer_id: stripeCustomerId,
      is_grandfathered: false,
    })

    if (profileError) {
      console.error('[complete-profile] Profile upsert failed:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Create subscription row
    const currentPeriodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null

    await admin.from('subscriptions').insert({
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscriptionId,
      status: stripeSub.status === 'active' ? 'active' : 'incomplete',
      plan,
      current_period_end: currentPeriodEnd,
    })

    return NextResponse.json({ success: true, workspaceEmail, username })
  } catch (error) {
    console.error('[complete-profile] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
