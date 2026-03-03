import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLANS } from '@/lib/stripe'
import { getAppUrl } from '@/lib/app-url'
import type { PlanKey } from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json() as { plan: PlanKey }
  const planConfig = PLANS[plan]

  if (!planConfig || !planConfig.priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const appUrl = getAppUrl(request)

  // Find or create Stripe customer
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let customerId = sub?.stripe_customer_id

  if (!customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single()

    const customer = await stripe.customers.create({
      email: user.email,
      name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      plan: 'free',
      status: 'inactive',
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/settings`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan },
    },
  })

  return NextResponse.json({ url: session.url })
}
