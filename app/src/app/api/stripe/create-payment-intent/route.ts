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

    // Create a subscription with payment_behavior='default_incomplete' so Stripe
    // returns a PaymentIntent we can confirm with Elements.
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    })

    // Resolve the invoice — latest_invoice may be a string ID or expanded object
    let invoice = subscription.latest_invoice as any
    if (typeof invoice === 'string') {
      invoice = await stripe.invoices.retrieve(invoice, { expand: ['payment_intent'] })
    }

    // Resolve the payment intent — may be a string ID or expanded object
    let paymentIntent = invoice?.payment_intent as any
    if (typeof paymentIntent === 'string') {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent)
    }

    if (!paymentIntent?.client_secret) {
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
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
