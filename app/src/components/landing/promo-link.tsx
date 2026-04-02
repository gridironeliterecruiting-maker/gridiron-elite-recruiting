'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPromoCookie } from '@/lib/promo-cookie'

type PromoLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & {
  href: string
}

export function PromoLink({ href, children, ...props }: PromoLinkProps) {
  const [finalHref, setFinalHref] = useState(href)

  useEffect(() => {
    const code = getPromoCookie()
    if (!code || !href.startsWith('/register')) {
      setFinalHref(href)
      return
    }
    const url = new URL(href, 'http://localhost')
    url.searchParams.set('promo', code)
    setFinalHref(url.pathname + url.search)
  }, [href])

  return (
    <Link href={finalHref} {...props}>
      {children}
    </Link>
  )
}
