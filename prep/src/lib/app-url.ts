export function getAppUrl(request?: Request) {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  if (request) {
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    if (host) return `${protocol}://${host}`
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3002'
  }
  return 'https://runwayeliteprep.com'
}
