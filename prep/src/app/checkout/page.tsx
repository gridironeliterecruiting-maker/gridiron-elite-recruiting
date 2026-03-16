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

const PRIMARY_COLOR = '#cc2222'
const ACCENT_COLOR = '#1a3a6e'

type Plan = 'monthly' | 'annual'

const PLAN_AMOUNTS: Record<Plan, number> = {
  monthly: 1000,  // $10.00
  annual: 9000,   // $90.00
}

function CheckoutForm({ clientSecret, plan }: { clientSecret: string; plan: Plan }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || 'Please check your card details.')
      setLoading(false)
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/profile-setup?plan=${plan}`,
      },
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
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
        style={{ background: PRIMARY_COLOR }}
      >
        {loading ? 'Processing...' : 'START MY JOURNEY'}
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
  const [stripePromise] = useState(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!))
  const [initError, setInitError] = useState('')

  const price = plan === 'annual' ? '$90/year' : '$10/month'

  useEffect(() => {
    setClientSecret(null)
    setInitError('')
    fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setInitError(data.error || 'Failed to initialize payment.')
        }
      })
      .catch(() => setInitError('Failed to initialize payment.'))
  }, [plan])

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
        <div className="flex flex-col items-center mb-6">
          <div className="relative h-[100px] w-[100px]">
            <Image src="/logo.png" alt="Runway Prep" fill className="object-contain" priority />
          </div>
          <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-widest" style={{ color: PRIMARY_COLOR }}>Runway Prep</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center mb-1 uppercase" style={{ color: ACCENT_COLOR }}>
            Choose Your Plan
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            Full access to the complete Runway Prep system.<br />Build your foundation.
          </p>

          <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-gray-50">
            <button
              type="button"
              onClick={() => setPlan('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'monthly' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
              style={plan === 'monthly' ? { color: ACCENT_COLOR } : {}}
            >
              Monthly · $10
            </button>
            <button
              type="button"
              onClick={() => setPlan('annual')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${plan === 'annual' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
              style={plan === 'annual' ? { color: ACCENT_COLOR } : {}}
            >
              Annual · $90
              <span className="ml-1.5 inline-block text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: PRIMARY_COLOR }}>
                Save 25%
              </span>
            </button>
          </div>

          <div className="text-center mb-6">
            <span className="text-3xl font-black" style={{ color: ACCENT_COLOR }}>{price}</span>
          </div>

          {initError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {initError}
            </div>
          )}

          {clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: ACCENT_COLOR, borderRadius: '8px' },
                },
              }}
            >
              <CheckoutForm clientSecret={clientSecret} plan={plan} />
            </Elements>
          ) : !initError ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Already have an account?{' '}
          <a href="/login" className="hover:underline" style={{ color: ACCENT_COLOR }}>Log in</a>
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
