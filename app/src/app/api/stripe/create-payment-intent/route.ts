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

    // Resolve the invoice — latest_invoice may be a string ID or expanded object
    let invoice = subscription.latest_invoice as any
    if (typeof invoice === 'string') {
      invoice = await stripe.invoices.retrieve(invoice, { expand: ['payment_intent'] })
    } else if (!invoice?.payment_intent) {
      // Nested expand didn't populate payment_intent — retrieve explicitly
      invoice = await stripe.invoices.retrieve(invoice.id, { expand: ['payment_intent'] })
    }

    // Resolve the payment intent — may be a string ID or expanded object
    let paymentIntent = invoice?.payment_intent as any
    if (typeof paymentIntent === 'string') {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent)
    }

    if (!paymentIntent?.client_secret) {
      const debugInfo = `sub=${subscription.id} status=${subscription.status} inv_type=${typeof invoice} inv_id=${invoice?.id} inv_status=${invoice?.status} inv_collection=${invoice?.collection_method} pi_type=${typeof paymentIntent} pi=${JSON.stringify(paymentIntent)?.slice(0,200)}`
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
