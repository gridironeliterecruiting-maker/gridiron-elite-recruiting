import Stripe from 'stripe'

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })
}

export function getPriceId(plan: 'monthly' | 'annual'): string {
  const id = plan === 'annual'
    ? process.env.STRIPE_PRICE_ANNUAL
    : process.env.STRIPE_PRICE_MONTHLY
  if (!id) throw new Error(`Missing env var for plan: ${plan}`)
  return id
}

export async function findOrCreateCustomer(stripe: Stripe, email: string): Promise<Stripe.Customer> {
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0]
  return stripe.customers.create({ email })
}
