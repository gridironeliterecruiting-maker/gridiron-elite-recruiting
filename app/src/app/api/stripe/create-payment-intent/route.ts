import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, findOrCreateCustomer, getPriceId } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { plan, promoCodeId } = await request.json()

    if (!plan) {
      return NextResponse.json({ error: 'plan is required' }, { status: 400 })
    }

    if (!['monthly', 'annual'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Get the authenticated user's email from their session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email ?? null

    const stripe = getStripe()
    const customer = await findOrCreateCustomer(stripe, userEmail)
    const priceId = getPriceId(plan as 'monthly' | 'annual')

    // Cancel any existing incomplete subscriptions for this customer to avoid stale state
    const existingSubs = await stripe.subscriptions.list({ customer: customer.id, status: 'incomplete', limit: 5 })
    for (const sub of existingSubs.data) {
      await stripe.subscriptions.cancel(sub.id)
    }

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customer.id,
      items: [{ price: priceId }],
      collection_method: 'charge_automatically',
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    }

    // Apply promo code discount if provided
    if (promoCodeId) {
      subscriptionParams.discounts = [{ promotion_code: promoCodeId }]
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams)

    // Persist the local subscriptions row immediately for BOTH the $0 and the
    // paid paths. The middleware gate on /profile-setup requires a row in our
    // DB (active OR incomplete) — without this insert the user bounces back to
    // /checkout in a loop. The Stripe webhook updates this row to 'active' when
    // payment confirms, so the gate on /hub (which requires 'active') still
    // does its job.
    if (user) {
      const stripeSubWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number }
      const currentPeriodEnd = stripeSubWithPeriod.current_period_end
        ? new Date(stripeSubWithPeriod.current_period_end * 1000).toISOString()
        : null
      const persistedStatus =
        subscription.status === 'active' || subscription.status === 'trialing'
          ? 'active'
          : 'incomplete'
      const admin = createAdminClient()
      await admin.from('subscriptions').upsert(
        {
          user_id: user.id,
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          status: persistedStatus,
          plan,
          current_period_end: currentPeriodEnd,
        },
        { onConflict: 'stripe_subscription_id' },
      )
    }

    // If the subscription is already active (e.g. 100% off coupon, $0 invoice),
    // there's no PaymentIntent — just return success with no clientSecret.
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return NextResponse.json({
        clientSecret: null,
        subscriptionId: subscription.id,
        customerId: customer.id,
        paid: true,
      })
    }

    // pi.invoice is not populated in list responses for this API version —
    // find the active PI by status instead (we just canceled all stale ones above)
    const piList = await stripe.paymentIntents.list({ customer: customer.id, limit: 10 })
    const paymentIntent = piList.data.find((pi) => pi.status === 'requires_payment_method')

    if (!paymentIntent?.client_secret) {
      return NextResponse.json({ error: `No active payment intent found. sub=${subscription.id}` }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
      paid: false,
    })

  } catch (error) {
    const e = error as { constructor?: { name?: string }; message?: string; code?: string; cause?: { message?: string } } | null
    console.error('[create-payment-intent] type:', e?.constructor?.name, 'message:', e?.message, 'code:', e?.code, 'cause:', e?.cause?.message)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
