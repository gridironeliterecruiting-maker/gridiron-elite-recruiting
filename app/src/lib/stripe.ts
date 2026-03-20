import Stripe from 'stripe'

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  })
}

export function getPriceId(plan: 'monthly' | 'annual'): string {
  const id = plan === 'annual'
    ? process.env.STRIPE_PRICE_ANNUAL
    : process.env.STRIPE_PRICE_MONTHLY
  if (!id) throw new Error(`Missing env var for plan: ${plan}`)
  return id
}

export async function findOrCreateCustomer(stripe: Stripe, email: string | null): Promise<Stripe.Customer> {
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 })
    if (existing.data.length > 0) return existing.data[0]
    return stripe.customers.create({ email })
  }
  return stripe.customers.create({})
}
