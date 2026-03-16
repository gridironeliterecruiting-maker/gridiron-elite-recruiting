import { cookies } from 'next/headers'

const COOKIE_NAME = 'active_player_id'

/**
 * Server-side: read active_player_id from cookie.
 */
export async function getActivePlayerId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}
