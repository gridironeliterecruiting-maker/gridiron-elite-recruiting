/**
 * Canonical seeded test users. Must mirror supabase/seed.sql.
 * Every user's password is 'password123' — local dev only, fine to commit.
 */
export const TEST_PASSWORD = 'password123'

export const TEST_USERS = {
  admin: {
    email: 'admin@example.test',
    password: TEST_PASSWORD,
    role: 'admin' as const,
  },
  athlete1: {
    email: 'athlete1@example.test',
    password: TEST_PASSWORD,
    role: 'athlete' as const,
  },
  athlete2: {
    email: 'athlete2@example.test',
    password: TEST_PASSWORD,
    role: 'athlete' as const,
  },
  coach: {
    email: 'coach1@example.test',
    password: TEST_PASSWORD,
    role: 'coach' as const,
  },
} as const

export type TestUserKey = keyof typeof TEST_USERS
