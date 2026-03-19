import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET /api/admin/promo-codes — list all promo codes
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const stripe = getStripe()
    const codes = await stripe.promotionCodes.list({ limit: 100, expand: ['data.promotion.coupon'] })

    const formatted = codes.data.map(pc => {
      const promo = pc.promotion as { coupon: Stripe.Coupon; type: string }
      const coupon = promo.coupon
      return {
        id: pc.id,
        code: pc.code,
        percent_off: coupon?.percent_off ?? null,
        amount_off: coupon?.amount_off ?? null,
        currency: coupon?.currency ?? null,
        duration: coupon?.duration ?? null,
        duration_in_months: coupon?.duration_in_months ?? null,
        max_redemptions: pc.max_redemptions ?? null,
        times_redeemed: pc.times_redeemed,
        valid: pc.active,
        created: pc.created,
      }
    })

    return NextResponse.json({ codes: formatted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load promo codes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/admin/promo-codes — create a new promo code
export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const stripe = getStripe()
    const { code, discountType, discountValue, duration, durationMonths, maxRedemptions } = await request.json()

    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    if (!discountValue || discountValue <= 0) return NextResponse.json({ error: 'Discount value must be > 0' }, { status: 400 })

    // Create the underlying coupon first
    const couponParams: Stripe.CouponCreateParams = {
      duration,
      ...(duration === 'repeating' ? { duration_in_months: durationMonths } : {}),
      ...(discountType === 'percent'
        ? { percent_off: discountValue }
        : { amount_off: Math.round(discountValue * 100), currency: 'usd' }),
    }
    const coupon = await stripe.coupons.create(couponParams)

    // Create the promotion code
    const promoCode = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code,
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
    })

    return NextResponse.json({
      code: {
        id: promoCode.id,
        code: promoCode.code,
        percent_off: coupon.percent_off ?? null,
        amount_off: coupon.amount_off ?? null,
        currency: coupon.currency ?? null,
        duration: coupon.duration,
        duration_in_months: coupon.duration_in_months ?? null,
        max_redemptions: promoCode.max_redemptions ?? null,
        times_redeemed: promoCode.times_redeemed,
        valid: promoCode.active,
        created: promoCode.created,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create promo code'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
