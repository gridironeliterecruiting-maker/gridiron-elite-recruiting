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

    const returnUrl = `${window.location.origin}/profile-setup?sub_id=${subscriptionId}&plan=${plan}`

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

  const [plan, setPlan] = useState<Plan>(initialPlan)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const price = plan === 'annual' ? '$450/year' : '$50/month'

  const fetchPaymentIntent = async (selectedPlan: Plan) => {
    setLoading(true)
    setError('')
    setClientSecret(null)
    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to initialize payment')
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

  useEffect(() => {
    fetchPaymentIntent(initialPlan)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlanChange = async (newPlan: Plan) => {
    setPlan(newPlan)
    await fetchPaymentIntent(newPlan)
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12"
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
              onClick={() => handlePlanChange('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'monthly' ? 'bg-white shadow text-[#0047AB]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly · $50
            </button>
            <button
              type="button"
              onClick={() => handlePlanChange('annual')}
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
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-[#0047AB] border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && clientSecret && (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: '#1a3a6e', borderRadius: '8px' },
                },
              }}
            >
              <CheckoutForm subscriptionId={subscriptionId!} email="" plan={plan} />
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
