import { NextResponse } from 'next/server'
import { getStripe, findOrCreateCustomer, getPriceId } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const { plan, email } = await request.json()

    if (!plan || !email) {
      return NextResponse.json({ error: 'plan and email are required' }, { status: 400 })
    }

    if (!['monthly', 'annual'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const stripe = getStripe()
    const customer = await findOrCreateCustomer(stripe, email)
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

    if (!paymentIntent?.client_secret) {
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
    })
  } catch (error: any) {
    console.error('[create-payment-intent]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
