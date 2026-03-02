/**
 * Get the current application URL dynamically
 * Works correctly in production, preview, and local environments
 */
export function getAppUrl(request?: Request) {
  // In browser, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // If we have a request object (server-side), extract the host
  if (request) {
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    if (host) {
      return `${protocol}://${host}`
    }
  }
  
  // On Vercel preview deployments, use the auto-generated URL
  if (process.env.VERCEL_URL) {
    // VERCEL_URL doesn't include protocol
    return `https://${process.env.VERCEL_URL}`
  }
  
  // In development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001'
  }
  
  // Check if we're on a Vercel deployment (preview or production)
  if (process.env.VERCEL) {
    // If NEXT_PUBLIC_VERCEL_URL is available (sometimes more reliable)
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    }
  }
  
  // Production fallback - only use this if nothing else works
  return 'https://runwayeliterecruiting.com'
}