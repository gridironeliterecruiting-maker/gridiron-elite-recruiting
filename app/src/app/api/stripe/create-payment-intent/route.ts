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

    const invoice = subscription.latest_invoice as any
    const paymentIntent = invoice?.payment_intent as any

    console.log('[create-payment-intent] sub.status:', subscription.status)
    console.log('[create-payment-intent] invoice type:', typeof invoice, 'id:', invoice?.id)
    console.log('[create-payment-intent] pi type:', typeof paymentIntent, 'status:', paymentIntent?.status, 'has_secret:', !!paymentIntent?.client_secret)

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
