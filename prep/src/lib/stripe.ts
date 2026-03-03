import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Basic athlete profile',
      'Up to 10 connections',
      'Dashboard overview',
    ],
  },
  starter: {
    name: 'Starter',
    price: 1999,
    priceId: process.env.STRIPE_PRICE_STARTER,
    features: [
      'Everything in Free',
      'Unlimited connections',
      'Interaction tracking',
      'Academic goal tracking',
    ],
  },
  pro: {
    name: 'Pro',
    price: 2999,
    priceId: process.env.STRIPE_PRICE_PRO,
    features: [
      'Everything in Starter',
      'Workout & training tasks',
      'Progress analytics',
      'Social/brand strategy module',
    ],
  },
  elite: {
    name: 'Elite',
    price: 4999,
    priceId: process.env.STRIPE_PRICE_ELITE,
    features: [
      'Everything in Pro',
      'Multiple athlete profiles',
      'Parent + athlete dual login',
      'Priority support',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS
