/**
 * Get the program base path from the current browser URL.
 * If the URL is /cityhigh-ia/dashboard, returns "/cityhigh-ia".
 * If the URL is /dashboard (no slug), returns "".
 */
export function getBasePath(): string {
  if (typeof window === 'undefined') return ''
  const segments = window.location.pathname.split('/').filter(Boolean)
  const appRoutes = ['dashboard', 'coaches', 'pipeline', 'outreach', 'profile']
  // If second segment is a known route, first segment is the slug
  if (segments.length >= 2 && appRoutes.includes(segments[1])) {
    return `/${segments[0]}`
  }
  return ''
}

/**
 * Build a program-aware path.
 * programPath("/outreach") → "/cityhigh-ia/outreach" or "/outreach"
 */
export function programPath(path: string): string {
  return `${getBasePath()}${path}`
}
