'use client'

import { useState, useEffect, Suspense } from 'react'
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

function CheckoutForm({
  subscriptionId,
  email,
  plan,
}: {
  subscriptionId: string
  email: string
  plan: Plan
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    const returnUrl = `${window.location.origin}/profile-setup?sub_id=${subscriptionId}&email=${encodeURIComponent(email)}&plan=${plan}`

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
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
        {loading ? 'Processing...' : 'Pay & Create Account'}
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

  const [plan, setPlan] = useState<Plan>(initialPlan)
  const [email, setEmail] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const price = plan === 'annual' ? '$450/year' : '$50/month'
  const priceNote = plan === 'annual' ? '$37.50/month · billed annually' : 'billed monthly'

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to initialize payment')
        setLoading(false)
        return
      }

      setClientSecret(data.clientSecret)
      setSubscriptionId(data.subscriptionId)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        backgroundImage: 'url(/locker-room-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
          <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">
            Start Recruiting
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            Full access — 11,000+ coaches, email campaigns, pipeline.
          </p>

          {/* Plan toggle */}
          <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-gray-50">
            <button
              type="button"
              onClick={() => { setPlan('monthly'); setClientSecret(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'monthly' ? 'bg-white shadow text-[#0047AB]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly · $50
            </button>
            <button
              type="button"
              onClick={() => { setPlan('annual'); setClientSecret(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'annual' ? 'bg-white shadow text-[#0047AB]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Annual · $450
              <span className="ml-1.5 inline-block bg-[#d93025] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Save 25%
              </span>
            </button>
          </div>

          <div className="text-center mb-6">
            <span className="text-3xl font-black text-[#0047AB]">{price}</span>
            <p className="text-xs text-gray-400 mt-1">{priceNote}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {!clientSecret ? (
            /* Step 1: Collect email */
            <form onSubmit={handleContinue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Used for your account recovery only — not for sending emails.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl font-display font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #1a3a6e 0%, #0d2040 100%)',
                }}
              >
                {loading ? 'Loading...' : 'Continue to Payment'}
              </button>
            </form>
          ) : (
            /* Step 2: Stripe payment */
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: '#1a3a6e', borderRadius: '8px' },
                },
              }}
            >
              <CheckoutForm subscriptionId={subscriptionId!} email={email} plan={plan} />
            </Elements>
          )}
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
