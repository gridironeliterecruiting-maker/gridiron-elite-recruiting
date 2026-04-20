import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 })
    }

    const stripe = getStripe()

    // Look up the promotion code by its user-facing code string
    const promoCodes = await stripe.promotionCodes.list({
      code: code.trim().toUpperCase(),
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })

    if (promoCodes.data.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 404 })
    }

    const promoCode = promoCodes.data[0]
    // SDK 2026: PromotionCode has .promotion (not .coupon)
    const promo = promoCode.promotion as { coupon: Stripe.Coupon }
    const coupon = promo.coupon

    // Check if max redemptions reached
    if (promoCode.max_redemptions && promoCode.times_redeemed >= promoCode.max_redemptions) {
      return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 404 })
    }

    // Build discount description
    let discountLabel = ''
    if (coupon.percent_off) {
      discountLabel = `${coupon.percent_off}% off`
    } else if (coupon.amount_off) {
      discountLabel = `$${(coupon.amount_off / 100).toFixed(0)} off`
    }

    if (coupon.duration === 'once') {
      discountLabel += ' (first payment)'
    } else if (coupon.duration === 'repeating' && coupon.duration_in_months) {
      discountLabel += ` for ${coupon.duration_in_months} months`
    } else if (coupon.duration === 'forever') {
      discountLabel += ' forever'
    }

    return NextResponse.json({
      promoCodeId: promoCode.id,
      code: promoCode.code,
      discountLabel,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[validate-promo]', msg)
    return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 })
  }
}
