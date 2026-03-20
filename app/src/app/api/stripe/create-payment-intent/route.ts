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

    // Get the invoice ID
    const invoiceRef = subscription.latest_invoice as any
    const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef?.id

    // Retrieve the invoice directly and dump its full structure for debugging
    const invoice = await stripe.invoices.retrieve(invoiceId) as any
    const invoiceKeys = Object.keys(invoice)
    const piField = invoice.payment_intent
    const piListRaw = await stripe.paymentIntents.list({ customer: customer.id, limit: 10 }) as any
    const piSummary = piListRaw.data.map((pi: any) => `id=${pi.id} invoice=${pi.invoice} status=${pi.status}`).join(' | ')

    return NextResponse.json({
      error: `inv_keys=${invoiceKeys.join(',')} | pi_field=${JSON.stringify(piField)?.slice(0,100)} | pis=${piSummary}`
    }, { status: 500 })

  } catch (error: any) {
    console.error('[create-payment-intent] type:', error?.constructor?.name, 'message:', error?.message, 'code:', error?.code, 'cause:', error?.cause?.message)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
