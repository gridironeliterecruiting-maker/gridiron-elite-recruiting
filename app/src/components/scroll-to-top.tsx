"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Scrolls the page to the top whenever the route changes.
 * Place in the (app) layout to ensure consistent behavior.
 */
export function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
