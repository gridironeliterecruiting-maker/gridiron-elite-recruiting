import { test, expect } from '@playwright/test'
import { signInAs } from './helpers'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * Regression test for the 100%-off promo registration bug.
 *
 * Bug Paul reported (prod): entering a 100%-off promo (INTRO2026), clicking
 * "Complete Signup" on /checkout → page refreshes back to /checkout instead
 * of moving forward to /profile-setup.
 *
 * Root cause: /api/stripe/create-payment-intent returns paid:true in the $0
 * path but doesn't insert a row into the local `subscriptions` table. The
 * middleware gate on /profile-setup requires an active subscription row in
 * the DB, so the user gets bounced back to /checkout in an infinite loop.
 *
 * This spec exercises the real production path end-to-end:
 *   1. Create a Stripe test-mode 100%-off coupon + promotion code.
 *   2. Authenticated POST /api/stripe/create-payment-intent → expect paid:true
 *      and a corresponding active row in our `subscriptions` table.
 *   3. GET /profile-setup → expect 200 (no redirect back to /checkout).
 *
 * The test fails on every version of the bug; passes only when the fix
 * actually persists the local subscription row.
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

test.describe('checkout — 100% off promo flow', () => {
  test.skip(!stripe || !admin, 'Stripe or Supabase env not configured locally')

  let couponId: string | null = null
  let promotionCodeId: string | null = null

  test.beforeAll(async () => {
    // Fresh state: any subscriptions left over from prior runs
    await admin!.from('subscriptions').delete().eq('user_id', ATHLETE_1_USER_ID)

    const coupon = await stripe!.coupons.create({
      percent_off: 100,
      duration: 'once',
      name: 'e2e-100-off',
    })
    couponId = coupon.id

    // Stripe API 2026-02-25.clover: PromotionCodes reference a `promotion`,
    // not a coupon directly. The promotion wraps the coupon.
    const promo = await stripe!.promotionCodes.create({
      promotion: { coupon: coupon.id, type: 'coupon' },
      code: `E2E${Date.now()}`,
    } as Stripe.PromotionCodeCreateParams)
    promotionCodeId = promo.id
  })

  test.afterAll(async () => {
    // Cancel any test Stripe subs for this customer to keep test mode tidy
    try {
      const customers = await stripe!.customers.list({
        email: 'athlete1@example.test',
        limit: 5,
      })
      for (const customer of customers.data) {
        const subs = await stripe!.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 10,
        })
        for (const sub of subs.data) {
          await stripe!.subscriptions.cancel(sub.id).catch(() => {})
        }
      }
    } catch {
      // best-effort cleanup
    }

    if (couponId) {
      await stripe!.coupons.del(couponId).catch(() => {})
    }
    await admin!.from('subscriptions').delete().eq('user_id', ATHLETE_1_USER_ID)
  })

  test('100%-off promo → paid:true → subscriptions row → /profile-setup loads', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const auth = { cookie: cookieHeader }

    // 1. Hit the route Paul hits when he clicks "Complete Signup"
    const res = await request.post('/api/stripe/create-payment-intent', {
      headers: auth,
      data: { plan: 'monthly', promoCodeId: promotionCodeId },
    })
    expect(res.status(), `expected 200 from create-payment-intent, got ${res.status()}`).toBe(200)
    const body = await res.json()
    expect(body.paid, 'paid must be true for a 100%-off subscription').toBe(true)
    expect(body.subscriptionId).toBeTruthy()

    // 2. The local subscriptions row is the load-bearing piece — without it
    //    the middleware will bounce the user back to /checkout.
    const { data: subs } = await admin!
      .from('subscriptions')
      .select('id, status, stripe_subscription_id')
      .eq('user_id', ATHLETE_1_USER_ID)
      .eq('status', 'active')

    expect(
      subs?.length,
      'create-payment-intent must persist a local subscriptions row in the $0 path; without it the middleware redirects /profile-setup → /checkout',
    ).toBeGreaterThan(0)
    expect(subs?.[0].stripe_subscription_id).toBe(body.subscriptionId)

    // 3. End-to-end smoke: navigating to /profile-setup must NOT redirect.
    await page.goto('/profile-setup')
    await expect(page).toHaveURL(/\/profile-setup/)
    await expect(page).not.toHaveURL(/\/checkout/)
  })
})
