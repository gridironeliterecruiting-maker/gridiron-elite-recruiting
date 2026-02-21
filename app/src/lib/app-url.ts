/**
 * Get the current application URL dynamically
 * Works correctly in production, preview, and local environments
 */
export function getAppUrl() {
  // In browser, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin
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
  
  // Fallback to configured URL or production
  return process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'
}