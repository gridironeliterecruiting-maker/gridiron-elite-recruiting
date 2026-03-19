const COOKIE_NAME = 'active_player_id'

/**
 * Client-side: write active_player_id cookie.
 */
export function setActivePlayerCookie(id: string) {
  document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

/**
 * Client-side: read active_player_id cookie.
 */
export function getActivePlayerCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? match[1] : null
}
