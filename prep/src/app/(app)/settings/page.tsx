'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/stripe'
import { Check } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Manage your subscription and account.</p>
      <Suspense>
        <BillingSection />
      </Suspense>
    </div>
  )
}

function BillingSection() {
  const searchParams = useSearchParams()
  const upgraded = searchParams.get('upgraded') === '1'
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('subscriptions').select('plan').then(({ data }) => {
      if (data?.[0]?.plan) setCurrentPlan(data[0].plan)
    })
  }, [])

  const handleUpgrade = async (planKey: string) => {
    setLoading(planKey)
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planKey }),
    })
    const { url, error } = await res.json()
    if (error) { alert(error); setLoading(null); return }
    window.location.href = url
  }

  const handleManage = async () => {
    setLoading('portal')
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url, error } = await res.json()
    if (error) { alert(error); setLoading(null); return }
    window.location.href = url
  }

  return (
    <div>
      {upgraded && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 text-green-800 p-4 font-medium">
          Your plan has been upgraded successfully!
        </div>
      )}

      <h2 className="font-bold text-lg mb-4">Subscription Plans</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => {
          const isCurrent = currentPlan === key
          return (
            <div
              key={key}
              className={`rounded-xl border-2 p-5 ${isCurrent ? 'border-blue-900 bg-blue-50' : 'border-border bg-card'}`}
            >
              {isCurrent && (
                <span className="inline-block text-xs font-bold bg-blue-900 text-white px-2 py-0.5 rounded-full mb-2">
                  Current Plan
                </span>
              )}
              <p className="font-bold text-lg">{plan.name}</p>
              <p className="text-2xl font-bold mt-1">
                {plan.price === 0 ? 'Free' : `$${(plan.price / 100).toFixed(2)}`}
                {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && plan.price > 0 && (
                <button
                  onClick={() => handleUpgrade(key)}
                  disabled={loading === key}
                  className="mt-4 w-full bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50"
                >
                  {loading === key ? 'Loading...' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {currentPlan !== 'free' && (
        <button
          onClick={handleManage}
          disabled={loading === 'portal'}
          className="text-sm text-blue-900 underline hover:no-underline disabled:opacity-50"
        >
          {loading === 'portal' ? 'Loading...' : 'Manage billing / cancel subscription'}
        </button>
      )}
    </div>
  )
}
