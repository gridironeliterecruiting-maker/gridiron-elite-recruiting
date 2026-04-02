const COOKIE_NAME = 'rr_promo'
const COOKIE_DAYS = 7

export function setPromoCookie(code: string) {
  const maxAge = COOKIE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; samesite=lax`
}

export function getPromoCookie(): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function clearPromoCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}
