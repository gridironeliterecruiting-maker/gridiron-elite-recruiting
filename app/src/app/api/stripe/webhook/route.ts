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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe/webhook] Signature verification failed:', msg)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription & { current_period_end?: number }
        const currentPeriodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
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

        const zohoKey = profile?.zoho_account_key as string | undefined
        if (zohoKey) {
          await deleteZohoAccount(zohoKey).catch(err =>
            console.error('[webhook] Failed to delete Zoho account:', err)
          )
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id

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
