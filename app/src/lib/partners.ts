export type Partner = {
  slug: string
  name: string
  code: string // Stripe promo code
}

const PARTNERS: Record<string, Partner> = {
  midwest7v7: {
    slug: 'midwest7v7',
    name: 'Midwest 7-on-7 Series',
    code: 'MIDWEST7V7',
  },
}

export function getPartner(slug: string): Partner | null {
  return PARTNERS[slug.toLowerCase()] ?? null
}
