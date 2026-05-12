import { test, expect } from '@playwright/test'
import { signInAs } from './helpers'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * Regression test for the paid-card checkout flow.
 *
 * The 100%-off test (checkout-100-off.spec.ts) caught the missing
 * subscriptions-row insert in the $0 path. The paid path has the same
 * shape: /api/stripe/create-payment-intent returns a clientSecret but
 * does not write a local row; the Stripe webhook handler only UPDATEs
 * existing rows, never INSERTs. Once Stripe redirects the user back
 * to /profile-setup, the middleware gate (active sub row required)
 * should reject them — but the prod paid flow has been working for
 * weeks. This test pins down whether the paid path is actually safe
 * or has the same hidden bug.
 *
 * What we test:
 *   1. Authenticated POST /api/stripe/create-payment-intent (no promo) →
 *      expect clientSecret + paid:false.
 *   2. Assert a row exists in `subscriptions` for the user, with a
 *      stripe_subscription_id matching the response.
 *   3. GET /profile-setup → expect 200 (no redirect to /checkout).
 *
 * If (2) or (3) fail, we have the same bug as the $0 path and the
 * fix is to insert the row in create-payment-intent unconditionally
 * (and let the middleware accept 'incomplete' until the webhook
 * promotes it to 'active').
 */

loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })
loadEnv({ path: path.resolve(__dirname, '..', '.env.development') })

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY, { apiVersion: '2026-02-25.clover' }) : null
const admin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null

const ATHLETE_1_USER_ID = '00000000-0000-0000-0000-000000000002'

test.describe('checkout — paid-card flow', () => {
  test.skip(!stripe || !admin, 'Stripe or Supabase env not configured locally')

  test.beforeAll(async () => {
    await admin!.from('subscriptions').delete().eq('user_id', ATHLETE_1_USER_ID)
  })

  test.afterAll(async () => {
    try {
      const customers = await stripe!.customers.list({
        email: 'athlete1@example.test',
        limit: 5,
      })
      for (const customer of customers.data) {
        const subs = await stripe!.subscriptions.list({
          customer: customer.id,
          status: 'incomplete',
          limit: 10,
        })
        for (const sub of subs.data) {
          await stripe!.subscriptions.cancel(sub.id).catch(() => {})
        }
      }
    } catch {
      // best-effort
    }
    await admin!.from('subscriptions').delete().eq('user_id', ATHLETE_1_USER_ID)
  })

  test('paid checkout creates a local sub row and lets user into /profile-setup', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const auth = { cookie: cookieHeader }

    // 1. Server-side subscription creation (the part our app owns).
    const res = await request.post('/api/stripe/create-payment-intent', {
      headers: auth,
      data: { plan: 'monthly', promoCodeId: null },
    })
    expect(res.status(), `expected 200, got ${res.status()}`).toBe(200)
    const body = await res.json()
    expect(body.paid, 'paid must be false when there is no covering promo').toBe(false)
    expect(body.clientSecret).toBeTruthy()
    expect(body.subscriptionId).toBeTruthy()

    // 2. The local row must exist before the user can pass the
    //    /profile-setup middleware gate.
    const { data: subs } = await admin!
      .from('subscriptions')
      .select('id, status, stripe_subscription_id')
      .eq('user_id', ATHLETE_1_USER_ID)

    expect(
      subs?.length,
      'create-payment-intent must persist a local subscriptions row so the user can reach /profile-setup after Stripe confirms the card',
    ).toBeGreaterThan(0)
    expect(subs?.[0].stripe_subscription_id).toBe(body.subscriptionId)

    // 3. The user must be able to reach /profile-setup with their pending
    //    subscription. Otherwise they're stuck looping back to /checkout
    //    even after Stripe collects the card and redirects them back.
    await page.goto('/profile-setup')
    await expect(page).toHaveURL(/\/profile-setup/)
    await expect(page).not.toHaveURL(/\/checkout/)
  })
})
