import { NextResponse } from 'next/server'
import { getStripe, findOrCreateCustomer, getPriceId } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { plan } = await request.json()

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

    // Create the subscription. collection_method must be charge_automatically
    // so Stripe generates a PaymentIntent (send_invoice skips it).
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      collection_method: 'charge_automatically',
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    })

    // Resolve the invoice ID
    const invoiceRef = subscription.latest_invoice as any
    const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef?.id

    // Resolve the payment intent — try invoice expand first, then fall back to
    // listing PaymentIntents for this customer filtered by invoice ID.
    let paymentIntent: any = typeof invoiceRef === 'object' ? invoiceRef?.payment_intent : undefined
    if (typeof paymentIntent === 'string') {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent)
    }

    if (!paymentIntent?.client_secret && invoiceId) {
      // Stripe API version may not populate payment_intent via expand — look it up directly
      const pis = await stripe.paymentIntents.list({ customer: customer.id, limit: 10 }) as any
      paymentIntent = pis.data.find((pi: any) => pi.invoice === invoiceId)
    }

    if (!paymentIntent?.client_secret) {
      const debugInfo = `sub=${subscription.id} status=${subscription.status} inv_id=${invoiceId} pi=${JSON.stringify(paymentIntent)?.slice(0, 200)}`
      console.error('[create-payment-intent] missing client_secret:', debugInfo)
      return NextResponse.json({ error: debugInfo }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
    })
  } catch (error: any) {
    console.error('[create-payment-intent] type:', error?.constructor?.name, 'message:', error?.message, 'code:', error?.code, 'cause:', error?.cause?.message)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
