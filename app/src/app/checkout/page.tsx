'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Plan = 'monthly' | 'annual'

const PLAN_AMOUNTS: Record<Plan, number> = {
  monthly: 5000,  // $50.00 in cents
  annual: 45000,  // $450.00 in cents
}

function CheckoutForm({ plan, promoCodeId }: { plan: Plan; promoCodeId: string | null }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    // Step 1: Validate card fields before hitting the server
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || 'Please check your card details.')
      setLoading(false)
      return
    }

    // Step 2: Create the subscription server-side (user is always logged in now)
    let clientSecret: string
    let subscriptionId: string
    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, promoCodeId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to initialize payment')
        setLoading(false)
        return
      }
      clientSecret = data.clientSecret
      subscriptionId = data.subscriptionId
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Step 3: Confirm payment with the clientSecret we just received
    const returnUrl = `${window.location.origin}/profile-setup?sub_id=${subscriptionId}&plan=${plan}`
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
    })

    if (stripeError) {
      setError(stripeError.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
    // On success, Stripe redirects to return_url automatically
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 rounded-xl font-display font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
          boxShadow: '0 4px 20px rgba(200,32,47,0.4)',
        }}
      >
        {loading ? 'Processing...' : 'PLACE ORDER'}
      </button>
      <p className="text-center text-xs text-gray-400">
        Secured by Stripe · Cancel anytime
      </p>
    </form>
  )
}

function CheckoutInner() {
  const searchParams = useSearchParams()
  const initialPlan = (searchParams.get('plan') as Plan) || 'monthly'
  const initialPromo = searchParams.get('promo') || ''
  const [plan, setPlan] = useState<Plan>(initialPlan)

  // Promo code state
  const [promoInput, setPromoInput] = useState(initialPromo)
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null)
  const [promoLabel, setPromoLabel] = useState('')
  const [promoPercentOff, setPromoPercentOff] = useState<number | null>(null)
  const [promoAmountOff, setPromoAmountOff] = useState<number | null>(null)
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoAppliedCode, setPromoAppliedCode] = useState('')

  // Auto-validate promo from URL param on mount
  const [autoValidated, setAutoValidated] = useState(false)
  if (initialPromo && !autoValidated) {
    setAutoValidated(true)
    // Trigger validation after render
    setTimeout(() => {
      validatePromo(initialPromo)
    }, 0)
  }

  async function validatePromo(code: string) {
    if (!code.trim()) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const res = await fetch('/api/stripe/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPromoError(data.error || 'Invalid promo code')
        setPromoCodeId(null)
        setPromoLabel('')
        setPromoPercentOff(null)
        setPromoAmountOff(null)
        setPromoAppliedCode('')
      } else {
        setPromoCodeId(data.promoCodeId)
        setPromoLabel(data.discountLabel)
        setPromoPercentOff(data.percentOff)
        setPromoAmountOff(data.amountOff)
        setPromoAppliedCode(code.trim().toUpperCase())
        setPromoError('')
      }
    } catch {
      setPromoError('Failed to validate promo code')
    } finally {
      setPromoLoading(false)
    }
  }

  function removePromo() {
    setPromoCodeId(null)
    setPromoLabel('')
    setPromoPercentOff(null)
    setPromoAmountOff(null)
    setPromoAppliedCode('')
    setPromoInput('')
    setPromoError('')
  }

  // Calculate discounted price
  function getDisplayPrice() {
    const baseAmount = plan === 'annual' ? 45000 : 5000
    if (promoPercentOff) {
      const discounted = baseAmount * (1 - promoPercentOff / 100)
      return `$${(discounted / 100).toFixed(0)}/${plan === 'annual' ? 'year' : 'month'}`
    }
    if (promoAmountOff) {
      const discounted = Math.max(0, baseAmount - promoAmountOff)
      return `$${(discounted / 100).toFixed(0)}/${plan === 'annual' ? 'year' : 'month'}`
    }
    return plan === 'annual' ? '$450/year' : '$50/month'
  }

  function getOriginalPrice() {
    return plan === 'annual' ? '$450/year' : '$50/month'
  }

  const hasDiscount = !!promoCodeId
  const price = getDisplayPrice()
  const originalPrice = getOriginalPrice()

  return (
    <div
      className="relative min-h-screen flex items-start justify-center px-4 py-12"
      style={{
        backgroundImage: 'url(/locker-room-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative h-[100px] w-[100px]">
            <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1 uppercase">
            Choose Plan
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            Full access to the complete Runway Recruit system.<br />Prepare for take off.
          </p>

          {/* Plan toggle */}
          <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-gray-50">
            <button
              type="button"
              onClick={() => setPlan('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'monthly' ? 'bg-white shadow text-[#0047AB]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly · $50
            </button>
            <button
              type="button"
              onClick={() => setPlan('annual')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'annual' ? 'bg-white shadow text-[#0047AB]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Annual · $450
              <span className="ml-1.5 inline-block bg-[#d93025] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Save 25%
              </span>
            </button>
          </div>

          <div className="text-center mb-6">
            {hasDiscount ? (
              <>
                <span className="text-lg font-semibold text-gray-400 line-through mr-2">{originalPrice}</span>
                <span className="text-3xl font-black text-[#0047AB]">{price}</span>
              </>
            ) : (
              <span className="text-3xl font-black text-[#0047AB]">{price}</span>
            )}
          </div>

          {/* Promo Code */}
          <div className="mb-6">
            {promoAppliedCode ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <div>
                  <span className="text-sm font-semibold text-green-800">{promoAppliedCode}</span>
                  <span className="ml-2 text-sm text-green-600">— {promoLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={removePromo}
                  className="text-xs font-semibold text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value); setPromoError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validatePromo(promoInput) } }}
                  placeholder="Promo code"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0047AB]/30 focus:border-[#0047AB]"
                />
                <button
                  type="button"
                  onClick={() => validatePromo(promoInput)}
                  disabled={!promoInput.trim() || promoLoading}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition"
                >
                  {promoLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {promoError && (
              <p className="mt-1.5 text-xs text-red-600">{promoError}</p>
            )}
          </div>

          {/* Elements mounts immediately — no API call needed until form submit */}
          <Elements
            key={plan}
            stripe={stripePromise}
            options={{
              mode: 'subscription',
              amount: PLAN_AMOUNTS[plan],
              currency: 'usd',
              paymentMethodTypes: ['card'],
              appearance: {
                theme: 'stripe',
                variables: { colorPrimary: '#1a3a6e', borderRadius: '8px' },
              },
            }}
          >
            <CheckoutForm plan={plan} promoCodeId={promoCodeId} />
          </Elements>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-[#0047AB] hover:underline">Log in</a>
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  )
}
