import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteZohoAccount } from '@/lib/workspace'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const stripe = getStripe()
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const subAny = sub as any
        const currentPeriodEnd = subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : null

        await admin.from('subscriptions')
          .update({
            status: sub.status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        await admin.from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)

        // Delete the Zoho account on subscription cancellation
        const { data: profile } = await admin
          .from('profiles')
          .select('zoho_account_key')
          .eq('stripe_customer_id', typeof sub.customer === 'string' ? sub.customer : sub.customer.id)
          .single()

        if ((profile as any)?.zoho_account_key) {
          await deleteZohoAccount((profile as any).zoho_account_key).catch(err =>
            console.error('[webhook] Failed to delete Zoho account:', err)
          )
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceAny = invoice as any
        const subId = typeof invoiceAny.subscription === 'string'
          ? invoiceAny.subscription
          : invoiceAny.subscription?.id

        if (subId) {
          await admin.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subId)
        }

        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
